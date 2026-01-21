# OpenCode RPC/Worker 模式详解

## 目录

1. [核心问题解答](#核心问题解答)
2. [架构概览](#架构概览)
3. [RPC 通信机制](#rpc-通信机制)
4. [核心组件详解](#核心组件详解)
5. [数据流分析](#数据流分析)
6. [构建和分发机制](#构建和分发机制)
7. [技术栈和兼容性](#技术栈和兼容性)
8. [使用示例](#使用示例)
9. [优势和设计考量](#优势和设计考量)

---

## 核心问题解答

### Q1: thread.ts 中的 `new Worker` 是什么？

**A**: `new Worker` 是 **Bun 运行时提供的 Worker API**。

```typescript
// thread.ts 第 93 行
const worker = new Worker(workerPath, {
  env: Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ),
})
```

这个 Worker API 创建了一个独立的工作线程，用于运行在指定路径的 JavaScript/TypeScript 代码。

### Q2: 它是 Web Workers API 吗？

**A**: 不是标准的 Web Workers API，但**API 设计和用法非常相似**。

**相似之处**：

- 都使用 `new Worker()` 创建工作线程
- 都通过 `postMessage()` 传递消息
- 都通过 `onmessage` 接收消息
- 都是消息传递的并发模型

**不同之处**：
| 特性 | Bun Workers | Web Workers |
|------|-------------|-------------|
| 运行环境 | Bun 运行时 | 浏览器 |
| 可访问的 API | Node.js/Bun API | DOM 不可用，部分 Web API |
| 文件系统 | 完全访问 | 不可直接访问 |
| 网络操作 | 完全支持 | 受限（同源策略） |
| 代码格式 | 支持 TypeScript/JS | 仅 JS |

### Q3: 这个 API 在 Node.js 中也可以工作吗？

**A**: 不能直接工作。`new Worker` 是 Bun 特有的 API，但 Node.js 有对应的替代方案。

### Q4: 打包后的 opencode 如何在 Node.js 环境中使用 Bun Workers？

**A**: **打包后的 opencode 不使用 Node.js 运行，而是使用 Bun 运行时！**

这是一个常见的误解。让我详细解释：

| 运行时      | Worker API                      | 特点                          |
| ----------- | ------------------------------- | ----------------------------- |
| **Bun**     | `new Worker()`                  | 原生支持 TypeScript，零配置   |
| **Node.js** | `new Worker()` (worker_threads) | 需要编译 TypeScript，功能类似 |
| **Node.js** | `worker_threads` 模块           | 标准的多线程方案              |

在 Node.js 中，你需要：

```javascript
// Node.js 写法
const { Worker } = require("worker_threads")
const worker = new Worker("./worker.js") // 必须是编译后的 JS
```

---

## 架构概览

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        主线程 (Main Thread)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  thread.ts                                            │  │
│  │  - TUI 界面渲染                                        │  │
│  │  - 用户交互处理                                        │  │
│  │  - 创建 RPC Client                                    │  │
│  │  - 发起 RPC 调用                                       │  │
│  │  - 监听 Worker 事件                                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │ postMessage (JSON)
                          │───────────────────────────────►
                          │                               │
                          │                               │
                          │◄──────────────────────────────│
                          │ onmessage (JSON)               │
                          │                               │
┌─────────────────────────┴───────────────────────────────────┐
│                      Worker 线程 (Worker Thread)              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  worker.ts                                            │  │
│  │  - RPC Server (Rpc.listen)                            │  │
│  │  - 业务逻辑处理                                        │  │
│  │  - Server API 代理                                     │  │
│  │  - 实例管理 (Instance)                                 │  │
│  │  - 事件流管理                                          │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  rpc.ts 桥接层                                         │  │
│  │  - 消息序列化/反序列化                                  │  │
│  │  - 请求路由                                            │  │
│  │  - Promise 管理                                       │  │
│  │  - 事件分发                                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 架构设计要点

1. **职责分离**
   - **主线程**：负责 UI 渲染和用户交互
   - **Worker 线程**：负责业务逻辑和资源密集型操作

2. **通信方式**
   - 使用消息传递（Message Passing）
   - 所有数据通过 JSON 序列化传递

3. **双向通信**
   - 主线程 → Worker：RPC 调用（request）
   - Worker → 主线程：RPC 响应（result）和事件（event）

---

## RPC 通信机制

### RPC 模块结构

```typescript
export namespace Rpc {
  type Definition = {
    [method: string]: (input: any) => any
  }

  export function listen(rpc: Definition)
  export function emit(event: string, data: unknown)
  export function client<T extends Definition>(target: Worker)
}
```

### 1. Rpc.listen() - 服务端监听

**作用**：在 Worker 线程中设置 RPC 服务器，监听来自主线程的调用请求。

**实现原理**：

```typescript
export function listen(rpc: Definition) {
  onmessage = async (evt) => {
    const parsed = JSON.parse(evt.data)
    if (parsed.type === "rpc.request") {
      // 1. 根据 method 调用对应的处理函数
      const result = await rpc[parsed.method](parsed.input)
      // 2. 将结果通过 postMessage 返回
      postMessage(
        JSON.stringify({
          type: "rpc.result",
          result,
          id: parsed.id, // 使用相同的 ID 进行关联
        }),
      )
    }
  }
}
```

**消息格式**：

**请求 (Request)**：

```json
{
  "type": "rpc.request",
  "method": "server", // 要调用的方法名
  "input": {
    // 方法参数
    "port": 8080,
    "hostname": "localhost"
  },
  "id": 0 // 请求 ID
}
```

**响应 (Result)**：

```json
{
  "type": "rpc.result",
  "result": {
    "url": "http://localhost:8080"
  },
  "id": 0
}
```

**使用示例**（worker.ts）：

```typescript
export const rpc = {
  async server(input: { port: number; hostname: string }) {
    // 业务逻辑
    const server = Server.listen(input)
    return { url: server.url.toString() }
  },

  async shutdown() {
    // 清理逻辑
    await Instance.disposeAll()
  },
}

// 启动 RPC 监听
Rpc.listen(rpc)
```

### 2. Rpc.client() - 客户端调用

**作用**：在主线程中创建 RPC 客户端，用于调用 Worker 中的方法。

**实现原理**：

```typescript
export function client<T extends Definition>(target: {
  postMessage: (data: string) => void | null
  onmessage: ((this: Worker, ev: MessageEvent<any>) => any) | null
}) {
  // 待处理的 Promise
  const pending = new Map<number, (result: any) => void>()
  // 事件监听器
  const listeners = new Map<string, Set<(data: any) => void>>()
  let id = 0

  // 监听 Worker 的响应
  target.onmessage = async (evt) => {
    const parsed = JSON.parse(evt.data)

    // 处理 RPC 响应
    if (parsed.type === "rpc.result") {
      const resolve = pending.get(parsed.id)
      if (resolve) {
        resolve(parsed.result)
        pending.delete(parsed.id)
      }
    }

    // 处理事件推送
    if (parsed.type === "rpc.event") {
      const handlers = listeners.get(parsed.event)
      if (handlers) {
        for (const handler of handlers) {
          handler(parsed.data)
        }
      }
    }
  }

  return {
    // 调用远程方法
    call<Method extends keyof T>(method: Method, input: Parameters<T[Method]>[0]): Promise<ReturnType<T[Method]>> {
      const requestId = id++
      return new Promise((resolve) => {
        pending.set(requestId, resolve)
        target.postMessage(
          JSON.stringify({
            type: "rpc.request",
            method,
            input,
            id: requestId,
          }),
        )
      })
    },

    // 监听事件
    on<Data>(event: string, handler: (data: Data) => void) {
      let handlers = listeners.get(event)
      if (!handlers) {
        handlers = new Set()
        listeners.set(event, handlers)
      }
      handlers.add(handler)
      return () => {
        handlers!.delete(handler)
      }
    },
  }
}
```

**类型安全**：

```typescript
// TypeScript 会自动推断类型
const client = Rpc.client<typeof rpc>(worker)

// ✓ 类型安全：参数和返回值都有完整的类型检查
const result = await client.call("server", {
  port: 8080,
  hostname: "localhost",
})

// ✓ 类型安全：事件数据也有类型检查
client.on("event", (event: Event) => {
  console.log(event.type)
})
```

### 3. Rpc.emit() - 事件推送

**作用**：从 Worker 向主线程推送事件。

**实现原理**：

```typescript
export function emit(event: string, data: unknown) {
  postMessage(
    JSON.stringify({
      type: "rpc.event",
      event, // 事件名称
      data, // 事件数据
    }),
  )
}
```

**消息格式**：

```json
{
  "type": "rpc.event",
  "event": "event",
  "data": {
    "type": "message",
    "content": "..."
  }
}
```

**使用示例**（worker.ts）：

```typescript
// 全局事件总线
GlobalBus.on("event", (event) => {
  Rpc.emit("global.event", event)
})

// SDK 事件流
for await (const event of events.stream) {
  Rpc.emit("event", event as Event)
}
```

### RPC 通信模式总结

| 模式      | 方向            | 方法                         | 用途                     |
| --------- | --------------- | ---------------------------- | ------------------------ |
| 请求-响应 | 主线程 → Worker | `client.call()`              | 同步调用 Worker 中的方法 |
| 事件推送  | Worker → 主线程 | `Rpc.emit()` + `client.on()` | 异步推送实时事件         |

---

## 核心组件详解

### 1. worker.ts - Worker 线程实现

**职责**：

- 运行业务逻辑
- 管理 Server 实例
- 处理项目实例（Instance）
- 推送事件到主线程

**RPC 方法**：

```typescript
export const rpc = {
  // 1. fetch - 代理 HTTP 请求到 Server API
  async fetch(input: { url: string; method: string; headers: Record<string, string>; body?: string }) {
    const request = new Request(input.url, {
      method: input.method,
      headers: input.headers,
      body: input.body,
    })
    const response = await Server.App().fetch(request)
    const body = await response.text()
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    }
  },

  // 2. server - 启动 HTTP 服务器
  async server(input: { port: number; hostname: string; mdns?: boolean; cors?: string[] }) {
    if (server) await server.stop(true)
    server = Server.listen(input)
    return { url: server.url.toString() }
  },

  // 3. checkUpgrade - 检查版本升级
  async checkUpgrade(input: { directory: string }) {
    await Instance.provide({
      directory: input.directory,
      init: InstanceBootstrap,
      fn: async () => {
        await upgrade().catch(() => {})
      },
    })
  },

  // 4. reload - 重新加载配置
  async reload() {
    Config.global.reset()
    await Instance.disposeAll()
  },

  // 5. shutdown - 关闭 Worker
  async shutdown() {
    Log.Default.info("worker shutting down")
    if (eventStream.abort) eventStream.abort.abort()
    await Instance.disposeAll()
    if (server) server.stop(true)
  },
}
```

**事件流管理**：

```typescript
const startEventStream = (directory: string) => {
  const abort = new AbortController()

  const sdk = createOpencodeClient({
    baseUrl: "http://opencode.internal",
    directory,
    fetch: fetchFn,
    signal: abort.signal,
  })

  // 订阅 SDK 事件
  while (!signal.aborted) {
    const events = await sdk.event.subscribe({}, { signal })
    for await (const event of events.stream) {
      // 通过 RPC 推送到主线程
      Rpc.emit("event", event as Event)
    }
  }
}
```

### 2. thread.ts - 主线程实现

**职责**：

- 创建 Worker
- 初始化 RPC Client
- 桥接 fetch 和 EventSource
- 管理 TUI 生命周期

**Worker 创建**：

```typescript
// 第 79-93 行
const localWorker = new URL("./worker.ts", import.meta.url)
const distWorker = new URL("./cli/cmd/tui/worker.js", import.meta.url)
const workerPath = await iife(async () => {
  // 优先使用编译后的 JS 文件
  if (typeof OPENCODE_WORKER_PATH !== "undefined") return OPENCODE_WORKER_PATH
  if (await Bun.file(distWorker).exists()) return distWorker
  return localWorker // 开发模式使用 TypeScript
})

// 创建 Worker 实例
const worker = new Worker(workerPath, {
  env: Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ),
})

// 创建 RPC Client
const client = Rpc.client<typeof rpc>(worker)
```

**Fetch 桥接**：

```typescript
// 第 19-35 行
function createWorkerFetch(client: RpcClient): typeof fetch {
  const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    const body = request.body ? await request.text() : undefined

    // 通过 RPC 调用 Worker 中的 fetch 方法
    const result = await client.call("fetch", {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    })

    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    })
  }
  return fn as typeof fetch
}
```

**EventSource 桥接**：

```typescript
// 第 37-41 行
function createEventSource(client: RpcClient): EventSource {
  return {
    on: (handler) => client.on<Event>("event", handler),
  }
}
```

**使用场景判断**（第 118-141 行）：

```typescript
const networkOpts = await resolveNetworkOptions(args)
const shouldStartServer =
  process.argv.includes("--port") ||
  process.argv.includes("--hostname") ||
  process.argv.includes("--mdns") ||
  networkOpts.mdns ||
  networkOpts.port !== 0 ||
  networkOpts.hostname !== "127.0.0.1"

if (shouldStartServer) {
  // 模式 1：启动 HTTP 服务器（用于远程访问）
  const server = await client.call("server", networkOpts)
  url = server.url
} else {
  // 模式 2：直接 RPC 通信（本地使用，更快）
  url = "http://opencode.internal"
  customFetch = createWorkerFetch(client)
  events = createEventSource(client)
}
```

### 3. rpc.ts - RPC 实现细节

**核心特性**：

1. **类型安全**：使用 TypeScript 泛型确保类型安全
2. **Promise 支持**：将异步消息传递转换为 Promise
3. **事件订阅**：支持多对一事件监听
4. **请求 ID 匹配**：使用 ID 关联请求和响应

**消息生命周期**：

```
主线程                          Worker
  │                              │
  │ client.call("method")        │
  │                              │
  ├─ postMessage(request) ─────►│ onmessage
  │                              │
  │                              ├─ rpc[method](input)
  │                              │
  │                              │
  │◄──── postMessage(result) ────┤
  │                              │
  Promise.resolve(result)       │
```

---

## 数据流分析

### 场景 1：启动 TUI（本地模式）

```
1. 用户执行: opencode tui

2. thread.ts 启动
   ├─ 创建 Worker
   ├─ 创建 RPC Client
   └─ 不启动 HTTP Server（shouldStartServer = false）

3. TUI 启动
   └─ tui({ url, fetch, events })
       ├─ url = "http://opencode.internal"
       ├─ fetch = createWorkerFetch(client)  // 自定义 fetch
       └─ events = createEventSource(client)  // 自定义 EventSource

4. TUI 发送请求
   ├─ fetch("/api/xxx")
   │   └─ createWorkerFetch
   │       └─ client.call("fetch", { ... })
   │           └─ postMessage 到 Worker
   │               └─ Worker.rpc.fetch()
   │                   └─ Server.App().fetch()
   │                       └─ 返回结果
   │                           └─ postMessage 回主线程
   │                               └─ Promise.resolve
   │                                   └─ TUI 收到响应
   │
   └─ events.on(handler)
       └─ client.on("event", handler)
           └─ 等待 Worker 推送
               └─ Worker: Rpc.emit("event", data)
                   └─ postMessage 到主线程
                       └─ handler(data)
```

### 场景 2：启动 TUI（远程模式）

```
1. 用户执行: opencode tui --port 8080

2. thread.ts 启动
   ├─ 创建 Worker
   ├─ 创建 RPC Client
   └─ 调用 client.call("server", { port: 8080 })
       └─ Worker 启动 HTTP Server

3. TUI 启动
   └─ tui({ url, fetch, events })
       ├─ url = "http://localhost:8080"  // Server URL
       ├─ fetch = undefined  // 使用原生 fetch
       └─ events = undefined  // 使用原生 EventSource

4. 外部客户端访问
   └─ GET http://localhost:8080/api/xxx
       └─ HTTP Server (在 Worker 中)
           └─ Server.App().fetch()
               └─ 返回响应
```

### 事件流（本地模式）

```
Worker (worker.ts)                主线程 (thread.ts)
    │                                  │
    │ GlobalBus.emit("event")          │
    │     or                           │
    │ SDK 事件流                      │
    │                                  │
    ├─ Rpc.emit("event", data) ───────►│
    │   { type: "rpc.event" }          │
    │                                  │
    │                                  ├─ onmessage
    │                                  │   ├─ parsed.type === "rpc.event"
    │                                  │   └─ handlers.get("event")
    │                                  │       └─ for handler in handlers:
    │                                  │           ├─ handler(data)
    │                                  │           └─ TUI 更新界面
    │                                  │
```

---

## 构建和分发机制

### 关键洞察：OpenCode 不依赖 Node.js

**核心事实**：OpenCode 打包后是一个**原生的 Bun 二进制文件**，不依赖 Node.js 运行！

### 构建流程详解

#### 1. Bun.build() 打包

```typescript
// script/build.ts (第 130-146 行)
await Bun.build({
  conditions: ["browser"],
  tsconfig: "./tsconfig.json",
  plugins: [solidPlugin],
  sourcemap: "external",
  compile: {
    target: "bun", // 目标是 Bun 运行时
    outfile: `dist/${name}/bin/opencode`,
    execArgv: ["--user-agent=opencode/${Script.version}", "--use-system-ca", "--"],
  },
  entrypoints: [
    "./src/index.ts", // 主入口
    parserWorker, // parser worker
    workerPath, // TUI worker (worker.ts)
  ],
  define: {
    OPENCODE_WORKER_PATH: workerPath, // Worker 路径常量
  },
})
```

**关键点**：

- `target: "bun"`：明确指定目标为 Bun 运行时
- 包含 `worker.ts` 作为入口点之一
- 编译为独立的二进制可执行文件

#### 2. 输出产物

```bash
$ file dist/opencode-darwin-arm64/bin/opencode
Mach-O 64-bit executable arm64
```

**输出格式**：

- macOS: Mach-O 64-bit executable
- Linux: ELF 64-bit executable
- Windows: PE32+ executable

**这些都是原生的可执行文件，不是 JavaScript！**

#### 3. 多平台构建

```typescript
// script/build.ts (第 22-79 行)
const allTargets = [
  { os: "linux", arch: "arm64" },
  { os: "linux", arch: "x64" },
  { os: "linux", arch: "x64", abi: "musl" },
  { os: "darwin", arch: "arm64" },
  { os: "darwin", arch: "x64" },
  { os: "win32", arch: "x64" },
  // ... 更多组合
]
```

为每个平台构建独立的二进制文件：

- `opencode-darwin-arm64`
- `opencode-darwin-x64`
- `opencode-linux-arm64`
- `opencode-linux-x64`
- `opencode-windows-x64`
- 等等

### 分发机制

#### 1. NPM 包结构

```json
// package.json
{
  "bin": {
    "opencode": "./bin/opencode"
  },
  "os": ["darwin"], // 平台特定
  "cpu": ["arm64"] // 架构特定
}
```

**NPM 选择性安装**：

- NPM 会根据当前平台和架构自动选择对应的包
- macOS ARM64 用户安装 `opencode-darwin-arm64`
- Linux x64 用户安装 `opencode-linux-x64`

#### 2. bin/opencode 包装脚本

```javascript
// bin/opencode
#!/usr/bin/env node

const childProcess = require("child_process")
const fs = require("fs")
const path = require("path")

// 查找对应的二进制文件
const platformMap = {
  darwin: "darwin",
  linux: "linux",
  win32: "windows",
}
const archMap = {
  x64: "x64",
  arm64: "arm64",
}

const base = "opencode-" + platform + "-" + arch
const binary = path.join("node_modules", base, "bin", "opencode")

// 执行 Bun 二进制
const result = childProcess.spawnSync(binary, process.argv.slice(2), {
  stdio: "inherit",
})
```

**工作流程**：

1. 用户执行 `npx opencode tui`
2. Node.js 运行 `bin/opencode` 脚本
3. 脚本找到对应平台的 Bun 二进制
4. 脚本执行 Bun 二进制（不是 Node.js！）
5. Bun 运行时启动，使用 Bun Workers API

### 为什么不需要兼容 Node.js？

#### 原因分析

```
┌─────────────────────────────────────────────┐
│  用户执行: opencode tui                     │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Node.js (仅用于执行包装脚本)              │
│  bin/opencode (JavaScript)                 │
└─────────────┬───────────────────────────────┘
              │
              ▼ spawn()
┌─────────────────────────────────────────────┐
│  Bun 二进制 (实际运行时)                   │
│  dist/opencode-darwin-arm64/bin/opencode  │
│  - 包含完整代码                            │
│  - 包含 Bun 运行时                         │
│  - 支持 Bun Workers API                    │
└─────────────┬───────────────────────────────┘
              │
              ├─ 主线程
              │  └─ TUI 渲染
              │
              └─ Worker 线程 (Bun Workers API)
                 └─ 业务逻辑
```

**关键点**：

- Node.js 只是一个"启动器"
- 实际运行的是 Bun 二进制
- Bun 二进制自带完整的运行时，包括 Worker API
- 不需要 Node.js 兼容层

#### 与传统 Node.js 项目的对比

| 特性       | 传统 Node.js 项目  | OpenCode               |
| ---------- | ------------------ | ---------------------- |
| 分发方式   | JavaScript 源码    | 预编译二进制           |
| 运行时     | 依赖 Node.js       | 自包含 Bun             |
| 启动方式   | `node index.js`    | 直接执行二进制         |
| 依赖安装   | npm install 二进制 | npm install 包含二进制 |
| Worker API | worker_threads     | Bun Workers            |
| 性能       | 解释执行           | JIT 编译执行           |

### 构建命令使用

```bash
# 开发模式（使用 Bun 运行 TypeScript）
bun run --conditions=browser ./src/index.ts

# 构建所有平台
bun run build

# 构建当前平台（更快）
bun run build --single

# 构建 baseline 版本（旧 CPU 兼容）
bun run build --single --baseline
```

### 版本兼容性

#### Bun 版本选择

```typescript
// 构建时指定 Bun 版本
target: name.replace(pkg.name, "bun") as any
// 例如: "opencode-darwin-arm64" -> "bun-darwin-arm64"
```

**好处**：

- 使用稳定的 Bun 版本
- 用户不需要安装 Bun
- 避免版本兼容性问题

#### 旧 CPU 支持

```typescript
{
  os: "linux",
  arch: "x64",
  avx2: false,  // 不使用 AVX2 指令
}
```

**适用场景**：

- 老旧的服务器
- 虚拟机环境
- 云计算平台

### 常见问题解答

#### Q1: 为什么不直接使用 Node.js？

**A**:

1. **性能**：Bun 比 Node.js 快 2-3 倍
2. **零配置**：直接运行 TypeScript
3. **单文件分发**：不需要复杂的依赖管理
4. **原生性能**：编译为原生代码，启动快

#### Q2: 用户需要安装 Bun 吗？

**A**: 不需要。Bun 运行时已打包在二进制文件中。

#### Q3: 如果在 Node.js 环境中使用 opencode 会怎样？

**A**:

- 可以正常使用
- Node.js 只是执行包装脚本
- 实际运行的是 Bun 二进制
- Node.js 的性能不影响 opencode

#### Q4: Bun Workers 和 Node.js worker_threads 可以共存吗？

**A**: 不需要。OpenCode 完全使用 Bun 运行时，不需要 Node.js 的 worker_threads。

#### Q5: 如何调试打包后的版本？

**A**:

```bash
# 使用源码映射
bun run build --single --sourcemap

# 调试时加载源码
opencode tui --print-logs
```

### 总结

OpenCode 的构建和分发机制是一个巧妙的方案：

1. **开发时**：使用 TypeScript + Bun，享受零配置开发体验
2. **构建时**：使用 `Bun.build()` 打包为原生二进制
3. **分发时**：通过 NPM 平台特定的包自动选择正确版本
4. **运行时**：使用自包含的 Bun 运行时，无需依赖

**核心优势**：

- ✅ 零运行时依赖（用户不需要安装 Bun）
- ✅ 原生性能（编译为机器码）
- ✅ 自动平台选择（NPM 自动选择）
- ✅ 完整的 Bun API 支持（包括 Workers）
- ✅ 单文件分发（不需要复杂的依赖）

---

## 技术栈和兼容性

### Bun Worker API

**特点**：

1. **零配置**：直接运行 TypeScript 文件
2. **高性能**：基于 JSC 引擎，启动快
3. **完整 API**：支持所有 Node.js API
4. **类型安全**：完整的 TypeScript 支持

**与标准 API 的对比**：

```typescript
// Bun Worker (OpenCode 使用)
import Worker from "worker_threads"

const worker = new Worker("./worker.ts") // ✅ 直接使用 TS
worker.postMessage({ data: "..." })

// Node.js Worker Threads
const { Worker } = require("worker_threads")
const worker = new Worker("./worker.js") // ❌ 需要先编译 TS
```

### Web Workers API 对比

| 特性        | Bun Workers         | Web Workers         |
| ----------- | ------------------- | ------------------- |
| 创建方式    | `new Worker(path)`  | `new Worker(path)`  |
| 消息传递    | `postMessage(data)` | `postMessage(data)` |
| 消息监听    | `onmessage`         | `onmessage`         |
| 代码格式    | TypeScript/JS       | 仅 JS               |
| DOM 访问    | ❌                  | ❌                  |
| 文件系统    | ✅ 完全访问         | ❌ 受限             |
| 网络操作    | ✅ 完全支持         | ⚠️ 同源策略         |
| Node.js API | ✅ 完全支持         | ❌                  |

**为什么 Bun Workers 不是 Web Workers**：

- Bun Workers 运行在 Bun 运行时，不是浏览器环境
- 无法访问 `window`, `document` 等 DOM API
- 可以访问 `process`, `fs` 等 Node.js API
- 主要用于服务端并发，而非浏览器卸载任务

### Node.js 兼容性

**问题**：Bun Workers API 在 Node.js 中**不直接工作**

**原因**：

- Node.js 原生不支持 `new Worker()` 语法
- Bun Workers API 是 Bun 特有的

**Node.js 等价方案**：

```javascript
// Node.js 使用 worker_threads 模块
const { Worker, isMainThread, parentPort } = require("worker_threads")

if (isMainThread) {
  // 主线程
  const worker = new Worker("./worker.js")
  worker.postMessage({ type: "request", data: "..." })
  worker.on("message", (result) => {
    console.log("收到响应:", result)
  })
} else {
  // Worker 线程
  parentPort.on("message", async (message) => {
    if (message.type === "request") {
      const result = await processData(message.data)
      parentPort.postMessage(result)
    }
  })
}
```

**移植 Bun 代码到 Node.js**：

```typescript
// 需要修改的地方：
// 1. import Worker from "worker_threads"
// 2. 编译 TypeScript 到 JavaScript
// 3. 使用 parentPort 替代 global onmessage
// 4. 使用 worker.postMessage 替代 global postMessage
```

### 跨平台兼容性考虑

OpenCode 当前选择 Bun Worker API 的原因：

1. **性能优先**：Bun 比 Node.js 更快
2. **开发体验**：零配置 TypeScript 支持
3. **技术栈统一**：整个项目使用 Bun 生态系统

如果需要支持 Node.js，可以：

1. 使用条件编译
2. 提供 Worker 线程封装层
3. 提供编译后的 JS 版本

---

## 使用示例

### 示例 1：简单的 RPC 调用

```typescript
// Worker 定义方法 (worker.ts)
export const rpc = {
  async greet(input: { name: string }) {
    return { message: `Hello, ${input.name}!` }
  },
}

Rpc.listen(rpc)
```

```typescript
// 主线程调用 (thread.ts)
const client = Rpc.client<typeof rpc>(worker)
const result = await client.call("greet", { name: "Alice" })
console.log(result) // { message: "Hello, Alice!" }
```

### 示例 2：处理异步操作

```typescript
// Worker 端
export const rpc = {
  async readFile(input: { path: string }) {
    const content = await Bun.file(input.path).text()
    return { content }
  },
}
```

```typescript
// 主线程端
const content = await client.call("readFile", { path: "./data.txt" })
console.log(content.content)
```

### 示例 3：事件推送

```typescript
// Worker 端：定期发送心跳
setInterval(() => {
  Rpc.emit("heartbeat", { timestamp: Date.now() })
}, 1000)
```

```typescript
// 主线程端：监听心跳
client.on("heartbeat", (data) => {
  console.log("收到心跳:", new Date(data.timestamp))
})

// 取消监听
const unsubscribe = client.on("heartbeat", handler)
// ...
unsubscribe()
```

### 示例 4：fetch 桥接（OpenCode 实际使用）

```typescript
// 主线程：自定义 fetch
const customFetch = createWorkerFetch(client)

// 使用自定义 fetch
const response = await customFetch("http://opencode.internal/api/session")
const data = await response.json()
```

```typescript
// Worker 端：RPC 实现
async fetch(input: FetchInput) {
  const response = await Server.App().fetch(
    new Request(input.url, input)
  )
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text()
  }
}
```

### 示例 5：错误处理

```typescript
// Worker 端：抛出错误
export const rpc = {
  async divide(input: { a: number; b: number }) {
    if (input.b === 0) {
      throw new Error("除数不能为零")
    }
    return { result: input.a / input.b }
  },
}
```

```typescript
// 主线程端：捕获错误
try {
  const result = await client.call("divide", { a: 10, b: 0 })
} catch (e) {
  console.error("RPC 调用失败:", e.message)
}
```

### 示例 6：完整的工作流程

```typescript
// 1. Worker 启动 (worker.ts)
import { Server } from "@/server/server"
import { Rpc } from "@/util/rpc"

export const rpc = {
  async start(input: { port: number }) {
    const server = Server.listen(input)
    return { url: server.url.toString() }
  },

  async stop() {
    // 停止服务
  },
}

Rpc.listen(rpc)
```

```typescript
// 2. 主线程使用 (thread.ts)
const worker = new Worker("./worker.ts")
const client = Rpc.client<typeof rpc>(worker)

// 启动服务
const { url } = await client.call("start", { port: 8080 })
console.log("服务已启动:", url)

// 监听事件
client.on("status", (status) => {
  console.log("状态更新:", status)
})

// 关闭服务
await client.call("stop")
```

---

## 优势和设计考量

### 为什么要采用 Worker 架构？

#### 1. **性能隔离**

**问题**：TUI 渲染和业务逻辑在同一个线程可能导致界面卡顿。

**解决方案**：

```
主线程：TUI 渲染 (60 FPS)
Worker 线程：业务逻辑（文件 I/O、网络请求、LLM 调用）
```

**收益**：

- TUI 始终流畅响应
- 长时间操作不会阻塞 UI
- 用户体验更好

#### 2. **资源隔离**

**问题**：业务逻辑中的错误可能导致整个应用崩溃。

**解决方案**：

```typescript
// worker.ts
worker.onerror = (e) => {
  Log.Default.error(e)
  // 不会影响主线程
}
```

**收益**：

- Worker 崩溃不导致 TUI 崩溃
- 可以重启 Worker 而不影响用户界面
- 错误边界更清晰

#### 3. **架构清晰**

**问题**：混合 UI 和业务逻辑导致代码难以维护。

**解决方案**：

```
thread.ts (主线程)
  ├─ TUI 相关
  ├─ 用户交互
  └─ RPC Client

worker.ts (Worker 线程)
  ├─ 业务逻辑
  ├─ Server API
  └─ RPC Server
```

**收益**：

- 职责明确
- 易于测试
- 易于扩展

### RPC 模式的优势

#### 1. **类型安全**

```typescript
// TypeScript 自动推断类型
const client = Rpc.client<typeof rpc>(worker)

// ✅ 编译时检查参数类型
const result = await client.call("server", {
  port: 8080, // 正确
  hostname: "localhost", // 正确
})

// ❌ 编译时报错
const result = await client.call("server", {
  port: "8080", // ❌ 类型错误：port 应该是 number
})
```

#### 2. **抽象层**

**优势**：

- 隐藏底层消息传递细节
- 提供类似本地调用的接口
- 统一的错误处理

#### 3. **灵活性**

**两种通信模式**：

1. **Request-Response**：`client.call()` - 适合需要返回值的操作
2. **Event Stream**：`client.on()` - 适合实时数据推送

#### 4. **可测试性**

**主线程测试**：

```typescript
// 可以 Mock Worker
const mockWorker = {
  postMessage: () => {},
  onmessage: null,
}
const client = Rpc.client<typeof rpc>(mockWorker)
```

**Worker 测试**：

```typescript
// 独立测试 RPC 方法
const rpc = {
  async greet(input: { name: string }) {
    return { message: `Hello, ${input.name}!` }
  },
}
const result = await rpc.greet({ name: "Alice" })
```

### 设计考量

#### 1. **消息序列化**

**当前实现**：

```typescript
postMessage(JSON.stringify({ ... }))
```

**优点**：

- 简单直接
- 可读性好（调试方便）

**潜在问题**：

- 无法传递函数、Map、Set 等特殊对象
- 二进制数据需要 Base64 编码

**改进空间**：

```typescript
// 使用结构化克隆算法
postMessage({ ... })  // 不需要 JSON.stringify
```

#### 2. **错误传递**

**当前实现**：

```typescript
// Worker 抛出的错误会作为 rejected Promise 返回
try {
  await client.call("method", {})
} catch (e) {
  console.error(e)
}
```

**改进建议**：

- 标准化错误格式
- 添加错误堆栈信息
- 区分业务错误和系统错误

#### 3. **超时处理**

**当前缺失**：

```typescript
// 可能无限等待
await client.call("method", {})
```

**改进建议**：

```typescript
// 添加超时支持
const result = await client.call("method", {}, { timeout: 5000 })
```

#### 4. **取消请求**

**当前缺失**：

```typescript
// 无法取消正在执行的请求
const promise = client.call("method", {})
// promise 无法取消
```

**改进建议**：

```typescript
// 使用 AbortController
const controller = new AbortController()
const promise = client.call("method", {}, { signal: controller.signal })
controller.abort() // 取消请求
```

### 性能优化建议

1. **批量操作**

   ```typescript
   // 当前：多次调用
   await client.call("readFile", { path: "a.txt" })
   await client.call("readFile", { path: "b.txt" })
   await client.call("readFile", { path: "c.txt" })

   // 优化：批量调用
   await client.call("readFiles", { paths: ["a.txt", "b.txt", "c.txt"] })
   ```

2. **二进制数据**

   ```typescript
   // 当前：Base64 编码
   postMessage(JSON.stringify({ data: base64Data }))

   // 优化：使用 Transferable Objects
   postMessage({ data: arrayBuffer }, [arrayBuffer])
   ```

3. **消息压缩**
   ```typescript
   // 大消息可以使用压缩
   const compressed = compress(JSON.stringify(data))
   postMessage(compressed)
   ```

---

## 总结

OpenCode 的 RPC/worker 模式是一个精心设计的架构方案：

### 核心概念

1. **Bun Workers**：高性能的 Node.js 兼容多线程 API
2. **RPC 模式**：基于消息传递的远程过程调用
3. **类型安全**：完整的 TypeScript 类型支持
4. **双向通信**：支持请求-响应和事件流

### 关键文件

- **rpc.ts**：RPC 实现核心
- **worker.ts**：Worker 端业务逻辑
- **thread.ts**：主线程 TUI 集成

### 优势

- ✅ 性能隔离：TUI 不受业务逻辑阻塞
- ✅ 类型安全：编译时检查
- ✅ 架构清晰：职责分离
- ✅ 易于扩展：支持自定义 RPC 方法
- ✅ 零配置：直接使用 TypeScript

### 适用场景

- TUI 应用
- 需要长时间运行的后台任务
- 需要实时事件推送
- 需要保持 UI 响应速度

这个架构是现代 Web 应用开发的一个优秀实践示例，特别适合需要高性能和良好用户体验的终端应用。
