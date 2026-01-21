# 06-LSP 层实现

## 目录

1. [概述](#概述)
2. [架构设计](#架构设计)
3. [LSP 服务器管理](#lsp-服务器管理)
4. [LSP 客户端连接](#lsp-客户端连接)
5. [LSP 功能实现](#lsp-功能实现)
6. [LSP 工具集成](#lsp-工具集成)
7. [支持的 LSP 服务器](#支持的-lsp-服务器)
8. [配置与扩展](#配置与扩展)
9. [工作流程](#工作流程)
10. [最佳实践](#最佳实践)
11. [故障排除](#故障排除)

---

## 概述

OpenCode 内置 Language Server Protocol (LSP) 层，提供代码智能功能，包括代码补全、定义跳转、引用查找、符号搜索、诊断信息等。LSP 层是 OpenCode 与各类编程语言语言服务器之间的桥梁，使得 OpenCode 能够理解多种编程语言的代码结构。

### 核心特性

- **多语言支持**：支持 TypeScript/JavaScript、Python、Go、Rust、C/C++、Java 等 20+ 种语言
- **自动服务器发现**：根据项目配置自动检测并启动相应的 LSP 服务器
- **智能连接管理**：动态管理 LSP 客户端连接，支持按需启动和缓存
- **实时诊断**：实时获取和显示代码错误、警告和提示
- **性能优化**：文件变更防抖、连接复用、并发请求处理

### 技术栈

| 技术                            | 版本  | 用途              |
| ------------------------------- | ----- | ----------------- |
| **vscode-jsonrpc**              | 8.2.1 | JSON-RPC 协议实现 |
| **vscode-languageserver-types** | -     | LSP 类型定义      |
| **TypeScript**                  | 5.8.2 | 类型系统          |

---

## 架构设计

### 高层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     OpenCode AI Agent                        │
└────────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────────┴────────────────────────────────┐
│                    LSP Tool Layer                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  lsp tool (tool/lsp.ts)                            │  │
│  │  - goToDefinition                                   │  │
│  │  - findReferences                                  │  │
│  │  - hover                                           │  │
│  │  - documentSymbol                                   │  │
│  │  - workspaceSymbol                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────────┴────────────────────────────────┐
│                   LSP Manager                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  LSP.index.ts                                      │  │
│  │  - Server Management                                │  │
│  │  - Client Pool                                     │  │
│  │  - Operation Routing                                │  │
│  │  - Event Bus                                       │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬─────────────────────────────────────────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
┌─────▼────────┐ ┌────▼───────┐ ┌───▼──────────┐
│ LSP Client  │ │ LSP Client │ │ LSP Client   │
│  (TS)       │ │  (Python)  │ │   (Go)       │
└─────┬────────┘ └────┬───────┘ └───┬──────────┘
      │               │               │
┌─────▼────────┐ ┌────▼───────┐ ┌───▼──────────┐
│ TS Server   │ │ Pyright/  │ │  gopls      │
│             │ │ Ty         │ │             │
└─────────────┘ └────────────┘ └─────────────┘
```

### 核心组件

#### 1. **LSP Manager** (`lsp/index.ts`)

- **职责**：
  - LSP 服务器注册和管理
  - LSP 客户端连接池
  - 文件类型与服务器映射
  - 操作路由和结果聚合

#### 2. **LSP Client** (`lsp/client.ts`)

- **职责**：
  - 与 LSP 服务器的 JSON-RPC 通信
  - 文档同步（打开、变更、关闭）
  - 诊断信息收集
  - 请求发送和响应处理

#### 3. **LSP Server Definitions** (`lsp/server.ts`)

- **职责**：
  - 定义所有支持的 LSP 服务器
  - 服务器启动和初始化逻辑
  - 工作空间根目录检测
  - 自动下载和安装

#### 4. **LSP Tool** (`tool/lsp.ts`)

- **职责**：
  - 提供 LSP 功能的统一接口
  - 参数验证和权限检查
  - 操作路由和结果格式化

---

## LSP 服务器管理

### 服务器定义结构

每个 LSP 服务器必须实现以下接口：

```typescript
export interface Info {
  id: string // 服务器唯一标识符
  extensions: string[] // 支持的文件扩展名
  global?: boolean // 是否全局可用
  root: RootFunction // 查找项目根目录的函数
  spawn(root: string): Promise<Handle | undefined> // 启动服务器的函数
}

type RootFunction = (file: string) => Promise<string | undefined>
```

### 服务器注册

LSP 服务器在 `lsp/index.ts` 中通过状态管理初始化：

```typescript
export namespace LSP {
  const state = Instance.state(
    async () => {
      const clients: LSPClient.Info[] = []
      const servers: Record<string, LSPServer.Info> = {}
      const cfg = await Config.get()

      if (cfg.lsp === false) {
        log.info("all LSPs are disabled")
        return { broken: new Set(), servers, clients, spawning: new Map() }
      }

      // 注册内置服务器
      for (const server of Object.values(LSPServer)) {
        servers[server.id] = server
      }

      // 过滤实验性服务器
      filterExperimentalServers(servers)

      // 合并用户自定义服务器
      for (const [name, item] of Object.entries(cfg.lsp ?? {})) {
        const existing = servers[name]
        if (item.disabled) {
          delete servers[name]
          continue
        }
        servers[name] = {
          ...existing,
          id: name,
          root: existing?.root ?? (async () => Instance.directory),
          extensions: item.extensions ?? existing?.extensions ?? [],
          spawn: async (root) => ({
            process: spawn(item.command[0], item.command.slice(1), {
              cwd: root,
              env: { ...process.env, ...item.env },
            }),
            initialization: item.initialization,
          }),
        }
      }

      return {
        broken: new Set<string>(),
        servers,
        clients,
        spawning: new Map<string, Promise<LSPClient.Info | undefined>>(),
      }
    },
    async (state) => {
      await Promise.all(state.clients.map((client) => client.shutdown()))
    },
  )
}
```

### 根目录检测

LSP 服务器需要知道项目根目录以正确初始化。OpenCode 提供了 `NearestRoot` 辅助函数：

```typescript
const NearestRoot = (includePatterns: string[], excludePatterns?: string[]): RootFunction => {
  return async (file) => {
    // 检查排除模式
    if (excludePatterns) {
      const excludedFiles = Filesystem.up({
        targets: excludePatterns,
        start: path.dirname(file),
        stop: Instance.directory,
      })
      const excluded = await excludedFiles.next()
      await excludedFiles.return()
      if (excluded.value) return undefined
    }

    // 查找最近的包含模式
    const files = Filesystem.up({
      targets: includePatterns,
      start: path.dirname(file),
      stop: Instance.directory,
    })
    const first = await files.next()
    await files.return()

    if (!first.value) return Instance.directory
    return path.dirname(first.value)
  }
}
```

### 客户端发现流程

当需要为某个文件启动 LSP 客户端时，系统执行以下流程：

```
1. 文件类型识别
   ↓
2. 查找匹配的 LSP 服务器
   ↓
3. 确定项目根目录
   ↓
4. 检查是否已有连接
   ├─ 是 → 复用现有客户端
   └─ 否 → 启动新服务器进程
       ↓
5. 初始化 LSP 客户端
   ↓
6. 添加到客户端池
```

---

## LSP 客户端连接

### 客户端创建

LSP 客户端使用 `vscode-jsonrpc` 库与 LSP 服务器通信：

```typescript
export async function create(input: { serverID: string; server: LSPServer.Handle; root: string }) {
  const connection = createMessageConnection(
    new StreamMessageReader(input.server.process.stdout as any),
    new StreamMessageWriter(input.server.process.stdin as any),
  )

  const diagnostics = new Map<string, Diagnostic[]>()

  // 监听诊断信息
  connection.onNotification("textDocument/publishDiagnostics", (params) => {
    const filePath = Filesystem.normalizePath(fileURLToPath(params.uri))
    diagnostics.set(filePath, params.diagnostics)
    Bus.publish(Event.Diagnostics, { path: filePath, serverID: input.serverID })
  })

  // 处理配置请求
  connection.onRequest("workspace/configuration", async () => {
    return [input.server.initialization ?? {}]
  })

  connection.listen()

  // 初始化 LSP 服务器
  await withTimeout(
    connection.sendRequest("initialize", {
      rootUri: pathToFileURL(input.root).href,
      processId: input.server.process.pid,
      workspaceFolders: [{ name: "workspace", uri: pathToFileURL(input.root).href }],
      initializationOptions: { ...input.server.initialization },
      capabilities: {
        window: { workDoneProgress: true },
        workspace: {
          configuration: true,
          didChangeWatchedFiles: { dynamicRegistration: true },
        },
        textDocument: {
          synchronization: { didOpen: true, didChange: true },
          publishDiagnostics: { versionSupport: true },
        },
      },
    }),
    45_000,
  )

  await connection.sendNotification("initialized", {})

  // 发送初始配置
  if (input.server.initialization) {
    await connection.sendNotification("workspace/didChangeConfiguration", {
      settings: input.server.initialization,
    })
  }

  return {
    root: input.root,
    get serverID() {
      return input.serverID
    },
    get connection() {
      return connection
    },
    notify: {
      /* 文档通知方法 */
    },
    get diagnostics() {
      return diagnostics
    },
    async waitForDiagnostics(input: { path: string }) {
      /* ... */
    },
    async shutdown() {
      /* ... */
    },
  }
}
```

### 文档同步

当文件被打开或修改时，客户端会通知 LSP 服务器：

```typescript
notify: {
  async open(input: { path: string }) {
    const file = Bun.file(input.path)
    const text = await file.text()
    const extension = path.extname(input.path)
    const languageId = LANGUAGE_EXTENSIONS[extension] ?? "plaintext"

    const version = files[input.path]

    if (version !== undefined) {
      // 文件已打开，发送变更通知
      const next = version + 1
      files[input.path] = next

      await connection.sendNotification("workspace/didChangeWatchedFiles", {
        changes: [{ uri: pathToFileURL(input.path).href, type: 2 /* Changed */ }],
      })

      await connection.sendNotification("textDocument/didChange", {
        textDocument: { uri: pathToFileURL(input.path).href, version: next },
        contentChanges: [{ text }],
      })
    } else {
      // 首次打开文件
      await connection.sendNotification("workspace/didChangeWatchedFiles", {
        changes: [{ uri: pathToFileURL(input.path).href, type: 1 /* Created */ }],
      })

      await connection.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri: pathToFileURL(input.path).href,
          languageId,
          version: 0,
          text,
        },
      })
      files[input.path] = 0
    }
  },
}
```

### 诊断等待

系统提供 `waitForDiagnostics` 方法等待特定文件的诊断结果：

```typescript
async waitForDiagnostics(input: { path: string }) {
  const normalizedPath = Filesystem.normalizePath(input.path)

  return await withTimeout(
    new Promise<void>((resolve) => {
      const unsub = Bus.subscribe(Event.Diagnostics, (event) => {
        if (event.properties.path === normalizedPath &&
            event.properties.serverID === result.serverID) {
          // 防抖以允许 LSP 发送后续诊断（如语义检查）
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(() => {
            unsub?.()
            resolve()
          }, DIAGNOSTICS_DEBOUNCE_MS) // 150ms
        }
      })
    }),
    3000,
  )
}
```

---

## LSP 功能实现

### 定义跳转 (Go to Definition)

```typescript
export async function definition(input: { file: string; line: number; character: number }) {
  return run(input.file, (client) =>
    client.connection
      .sendRequest("textDocument/definition", {
        textDocument: { uri: pathToFileURL(input.file).href },
        position: { line: input.line, character: input.character },
      })
      .catch(() => null),
  ).then((result) => result.flat().filter(Boolean))
}
```

### 引用查找 (Find References)

```typescript
export async function references(input: { file: string; line: number; character: number }) {
  return run(input.file, (client) =>
    client.connection
      .sendRequest("textDocument/references", {
        textDocument: { uri: pathToFileURL(input.file).href },
        position: { line: input.line, character: input.character },
        context: { includeDeclaration: true },
      })
      .catch(() => []),
  ).then((result) => result.flat().filter(Boolean))
}
```

### 悬停信息 (Hover)

```typescript
export async function hover(input: { file: string; line: number; character: number }) {
  return run(input.file, (client) => {
    return client.connection
      .sendRequest("textDocument/hover", {
        textDocument: { uri: pathToFileURL(input.file).href },
        position: { line: input.line, character: input.character },
      })
      .catch(() => null)
  })
}
```

### 文档符号 (Document Symbols)

```typescript
export async function documentSymbol(uri: string) {
  const file = new URL(uri).pathname
  return run(file, (client) =>
    client.connection
      .sendRequest("textDocument/documentSymbol", {
        textDocument: { uri },
      })
      .catch(() => []),
  )
    .then((result) => result.flat() as (LSP.DocumentSymbol | LSP.Symbol)[])
    .then((result) => result.filter(Boolean))
}
```

### 工作空间符号 (Workspace Symbols)

```typescript
const kinds = [
  SymbolKind.Class,
  SymbolKind.Function,
  SymbolKind.Method,
  SymbolKind.Interface,
  SymbolKind.Variable,
  SymbolKind.Constant,
  SymbolKind.Struct,
  SymbolKind.Enum,
]

export async function workspaceSymbol(query: string) {
  return runAll((client) =>
    client.connection
      .sendRequest("workspace/symbol", { query })
      .then((result: any) => result.filter((x: LSP.Symbol) => kinds.includes(x.kind)))
      .then((result: any) => result.slice(0, 10))
      .catch(() => []),
  ).then((result) => result.flat() as LSP.Symbol[])
}
```

### 实现查找 (Go to Implementation)

```typescript
export async function implementation(input: { file: string; line: number; character: number }) {
  return run(input.file, (client) =>
    client.connection
      .sendRequest("textDocument/implementation", {
        textDocument: { uri: pathToFileURL(input.file).href },
        position: { line: input.line, character: input.character },
      })
      .catch(() => null),
  ).then((result) => result.flat().filter(Boolean))
}
```

### 调用层次结构 (Call Hierarchy)

#### 准备调用层次结构

```typescript
export async function prepareCallHierarchy(input: { file: string; line: number; character: number }) {
  return run(input.file, (client) =>
    client.connection
      .sendRequest("textDocument/prepareCallHierarchy", {
        textDocument: { uri: pathToFileURL(input.file).href },
        position: { line: input.line, character: input.character },
      })
      .catch(() => []),
  ).then((result) => result.flat().filter(Boolean))
}
```

#### 调用者 (Incoming Calls)

```typescript
export async function incomingCalls(input: { file: string; line: number; character: number }) {
  return run(input.file, async (client) => {
    const items = (await client.connection
      .sendRequest("textDocument/prepareCallHierarchy", {
        textDocument: { uri: pathToFileURL(input.file).href },
        position: { line: input.line, character: input.character },
      })
      .catch(() => [])) as any[]

    if (!items?.length) return []
    return client.connection.sendRequest("callHierarchy/incomingCalls", { item: items[0] }).catch(() => [])
  }).then((result) => result.flat().filter(Boolean))
}
```

#### 被调用者 (Outgoing Calls)

```typescript
export async function outgoingCalls(input: { file: string; line: number; character: number }) {
  return run(input.file, async (client) => {
    const items = (await client.connection
      .sendRequest("textDocument/prepareCallHierarchy", {
        textDocument: { uri: pathToFileURL(input.file).href },
        position: { line: input.line, character: input.character },
      })
      .catch(() => [])) as any[]

    if (!items?.length) return []
    return client.connection.sendRequest("callHierarchy/outgoingCalls", { item: items[0] }).catch(() => [])
  }).then((result) => result.flat().filter(Boolean))
}
```

### 诊断信息聚合

```typescript
export async function diagnostics() {
  const results: Record<string, LSPClient.Diagnostic[]> = {}

  for (const result of await runAll(async (client) => client.diagnostics)) {
    for (const [path, diagnostics] of result.entries()) {
      const arr = results[path] || []
      arr.push(...diagnostics)
      results[path] = arr
    }
  }

  return results
}
```

---

## LSP 工具集成

### 工具定义

LSP 功能通过工具暴露给 AI Agent：

```typescript
export const LspTool = Tool.define("lsp", {
  description: DESCRIPTION,
  parameters: z.object({
    operation: z.enum(operations).describe("The LSP operation to perform"),
    filePath: z.string().describe("The absolute or relative path to file"),
    line: z.number().int().min(1).describe("The line number (1-based, as shown in editors)"),
    character: z.number().int().min(1).describe("The character offset (1-based, as shown in editors)"),
  }),
  execute: async (args, ctx) => {
    const file = path.isAbsolute(args.filePath) ? args.filePath : path.join(Instance.directory, args.filePath)

    await assertExternalDirectory(ctx, file)

    // 权限检查
    await ctx.ask({
      permission: "lsp",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const uri = pathToFileURL(file).href
    const position = {
      file,
      line: args.line - 1, // LSP 使用 0-based
      character: args.character - 1,
    }

    const exists = await Bun.file(file).exists()
    if (!exists) {
      throw new Error(`File not found: ${file}`)
    }

    const available = await LSP.hasClients(file)
    if (!available) {
      throw new Error("No LSP server available for this file type.")
    }

    await LSP.touchFile(file, true)

    const result: unknown[] = await (async () => {
      switch (args.operation) {
        case "goToDefinition":
          return LSP.definition(position)
        case "findReferences":
          return LSP.references(position)
        case "hover":
          return LSP.hover(position)
        case "documentSymbol":
          return LSP.documentSymbol(uri)
        case "workspaceSymbol":
          return LSP.workspaceSymbol("")
        case "goToImplementation":
          return LSP.implementation(position)
        case "prepareCallHierarchy":
          return LSP.prepareCallHierarchy(position)
        case "incomingCalls":
          return LSP.incomingCalls(position)
        case "outgoingCalls":
          return LSP.outgoingCalls(position)
      }
    })()

    const output = result.length === 0 ? `No results found for ${args.operation}` : JSON.stringify(result, null, 2)

    return {
      title: `${args.operation} ${path.relative(Instance.worktree, file)}:${args.line}:${args.character}`,
      metadata: { result },
      output,
    }
  },
})
```

### 支持的操作

| 操作                   | LSP 方法                            | 描述                         |
| ---------------------- | ----------------------------------- | ---------------------------- |
| `goToDefinition`       | `textDocument/definition`           | 跳转到符号定义位置           |
| `findReferences`       | `textDocument/references`           | 查找所有符号引用             |
| `hover`                | `textDocument/hover`                | 获取悬停信息（文档、类型等） |
| `documentSymbol`       | `textDocument/documentSymbol`       | 获取文档内所有符号           |
| `workspaceSymbol`      | `workspace/symbol`                  | 搜索整个工作空间的符号       |
| `goToImplementation`   | `textDocument/implementation`       | 跳转到接口或抽象方法的实现   |
| `prepareCallHierarchy` | `textDocument/prepareCallHierarchy` | 准备调用层次结构             |
| `incomingCalls`        | `callHierarchy/incomingCalls`       | 查找调用当前函数的所有函数   |
| `outgoingCalls`        | `callHierarchy/outgoingCalls`       | 查找当前函数调用的所有函数   |

---

## 支持的 LSP 服务器

### TypeScript/JavaScript

**服务器**：`typescript`

- **扩展名**：`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`
- **根目录检测**：查找 `package-lock.json`, `bun.lock`, `pnpm-lock.yaml`, `yarn.lock`
- **启动命令**：`bun x typescript-language-server --stdio`
- **初始化选项**：
  ```typescript
  {
    tsserver: {
      path: "/path/to/tsserver.js"
    }
  }
  ```

### Python

#### Pyright

**服务器**：`pyright`

- **扩展名**：`.py`, `.pyi`
- **根目录检测**：查找 `pyproject.toml`, `setup.py`, `pyrightconfig.json` 等
- **启动命令**：`pyright-langserver --stdio`
- **自动安装**：通过 `bun install pyright` 安装
- **虚拟环境支持**：自动检测 `.venv`, `venv`, `$VIRTUAL_ENV`

#### Ty (实验性)

**服务器**：`ty`

- **扩展名**：`.py`, `.pyi`
- **根目录检测**：查找 `pyproject.toml`, `ty.toml` 等
- **启动命令**：`ty server`
- **特性**：更快的类型检查，实验性功能
- **标志**：`OPENCODE_EXPERIMENTAL_LSP_TY`

### Go

**服务器**：`gopls`

- **扩展名**：`.go`
- **根目录检测**：
  - 优先查找 `go.work` (多模块工作区)
  - 其次查找 `go.mod`, `go.sum` (单模块)
- **启动命令**：`gopls`
- **自动安装**：通过 `go install golang.org/x/tools/gopls@latest` 安装
- **安装位置**：`$OPENCODE_INSTALL_DIR/bin`

### Rust

**服务器**：`rust`

- **扩展名**：`.rs`
- **根目录检测**：
  - 查找 `Cargo.toml`
  - 支持工作空间（查找 `[workspace]` 配置）
  - 向上查找工作空间根目录
- **启动命令**：`rust-analyzer`
- **要求**：必须手动安装 `rust-analyzer`

### C/C++

**服务器**：`clangd`

- **扩展名**：`.c`, `.cpp`, `.cc`, `.cxx`, `.c++`, `.h`, `.hpp`, `.hh`, `.hxx`, `.h++`
- **根目录检测**：查找 `compile_commands.json`, `compile_flags.txt`, `CMakeLists.txt` 等
- **启动命令**：`clangd --background-index --clang-tidy`
- **自动安装**：从 GitHub releases 下载对应平台版本
- **符号链接**：安装后自动创建 `clangd` 符号链接

### Java

**服务器**：`jdtls`

- **扩展名**：`.java`
- **根目录检测**：查找 `pom.xml`, `build.gradle`, `.project`
- **启动命令**：
  ```bash
  java -jar launcher.jar -configuration config_mac -data /tmp/jdtls-data ...
  ```
- **要求**：Java 21 或更新版本
- **自动下载**：从 Eclipse 官方下载 JDT Language Server

### C#

**服务器**：`csharp`

- **扩展名**：`.cs`
- **根目录检测**：查找 `.sln`, `.csproj`
- **启动命令**：`csharp-ls`
- **自动安装**：通过 `dotnet tool install csharp-ls --tool-path ...` 安装

### Ruby

**服务器**：`ruby-lsp`

- **扩展名**：`.rb`, `.rake`, `.gemspec`, `.ru`
- **根目录检测**：查找 `Gemfile`
- **启动命令**：`rubocop --lsp`
- **自动安装**：通过 `gem install rubocop --bindir ...` 安装

### Elixir

**服务器**：`elixir-ls`

- **扩展名**：`.ex`, `.exs`
- **根目录检测**：查找 `mix.exs`
- **启动命令**：`elixir-ls`
- **自动安装**：从 GitHub releases 下载并编译

### Zig

**服务器**：`zls`

- **扩展名**：`.zig`, `.zon`
- **根目录检测**：查找 `build.zig`
- **启动命令**：`zls`
- **自动安装**：从 GitHub releases 下载对应平台版本

### Vue

**服务器**：`vue`

- **扩展名**：`.vue`
- **根目录检测**：查找 `package-lock.json` 等
- **启动命令**：`bun x @vue/language-server --stdio`
- **自动安装**：通过 `bun install @vue/language-server` 安装

### Svelte

**服务器**：`svelte`

- **扩展名**：`.svelte`
- **根目录检测**：查找 `package-lock.json` 等
- **启动命令**：`bun x svelte-language-server --stdio`
- **自动安装**：通过 `bun install svelte-language-server` 安装

### Astro

**服务器**：`astro`

- **扩展名**：`.astro`
- **根目录检测**：查找 `package-lock.json` 等
- **启动命令**：`bun x @astrojs/language-server --stdio`
- **初始化选项**：
  ```typescript
  {
    typescript: {
      tsdk: "/path/to/tsserver.js"
    }
  }
  ```

### Biome

**服务器**：`biome`

- **扩展名**：`.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.vue`, `.css`, `.graphql` 等
- **根目录检测**：查找 `biome.json`, `package.json` 等
- **启动命令**：`biome lsp-proxy --stdio`
- **特性**：同时提供格式化和 linting

### Oxlint

**服务器**：`oxlint`

- **扩展名**：`.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.astro`, `.svelte` 等
- **根目录检测**：查找 `.oxlintrc.json`, `package.json` 等
- **启动命令**：`oxlint --lsp` 或 `oxc_language_server`
- **特性**：快速的 JavaScript/TypeScript linter

### ESLint

**服务器**：`eslint`

- **扩展名**：`.ts`, `.tsx`, `.js`, `.jsx`, `.vue` 等
- **根目录检测**：查找 `package-lock.json` 等
- **启动命令**：`bun x vscode-eslint/server/out/eslintServer.js --stdio`
- **自动安装**：从 GitHub 下载 VS Code ESLint server

### 其他语言

| 语言      | 服务器 ID          | 扩展名                         |
| --------- | ------------------ | ------------------------------ |
| Swift     | `sourcekit-lsp`    | `.swift`, `.objc`, `.objcpp`   |
| Kotlin    | `kotlin-ls`        | `.kt`, `.kts`                  |
| Lua       | `lua-ls`           | `.lua`                         |
| PHP       | `php intelephense` | `.php`                         |
| Dart      | `dart`             | `.dart`                        |
| YAML      | `yaml-ls`          | `.yaml`, `.yml`                |
| Terraform | `terraform`        | `.tf`, `.tfvars`               |
| Bash      | `bash`             | `.sh`, `.bash`, `.zsh`, `.ksh` |
| OCaml     | `ocaml-lsp`        | `.ml`, `.mli`                  |
| Prisma    | `prisma`           | `.prisma`                      |

---

## 配置与扩展

### 禁用 LSP

完全禁用所有 LSP 服务器：

```json
{
  "lsp": false
}
```

### 禁用特定 LSP 服务器

```json
{
  "lsp": {
    "eslint": {
      "disabled": true
    },
    "biome": {
      "disabled": true
    }
  }
}
```

### 自定义 LSP 服务器

添加自定义 LSP 服务器：

```json
{
  "lsp": {
    "my-custom-server": {
      "command": ["path/to/server", "--stdio"],
      "extensions": [".custom"],
      "env": {
        "CUSTOM_VAR": "value"
      },
      "initialization": {
        "custom": "config"
      }
    }
  }
}
```

### 环境变量

| 变量                            | 描述                    |
| ------------------------------- | ----------------------- |
| `OPENCODE_DISABLE_LSP_DOWNLOAD` | 禁止自动下载 LSP 服务器 |
| `OPENCODE_EXPERIMENTAL_LSP_TY`  | 启用 Ty (替代 Pyright)  |

### 诊断显示格式化

```typescript
export namespace Diagnostic {
  export function pretty(diagnostic: LSPClient.Diagnostic) {
    const severityMap = {
      1: "ERROR",
      2: "WARN",
      3: "INFO",
      4: "HINT",
    }

    const severity = severityMap[diagnostic.severity || 1]
    const line = diagnostic.range.start.line + 1
    const col = diagnostic.range.start.character + 1

    return `${severity} [${line}:${col}] ${diagnostic.message}`
  }
}
```

---

## 工作流程

### 典型的 LSP 操作流程

```
1. Agent 调用 LSP 工具
   ↓
2. 工具验证参数和权限
   ↓
3. 检查文件是否存在
   ↓
4. 查找匹配的 LSP 服务器
   ↓
5. 启动或复用 LSP 客户端
   ↓
6. 发送文件变更通知
   ↓
7. 等待诊断完成（可选）
   ↓
8. 发送 LSP 请求
   ↓
9. 聚合多个客户端的结果
   ↓
10. 格式化并返回结果
```

### 文件变更处理

```
1. 文件被修改
   ↓
2. touchFile(file, waitForDiagnostics)
   ↓
3. 为文件查找所有相关 LSP 客户端
   ↓
4. 并行发送 didOpen/didChange 通知
   ↓
5. 客户端发布诊断事件
   ↓
6. 等待诊断完成（如果 waitForDiagnostics=true）
   ↓
7. 返回控制
```

### 客户端生命周期

```
1. 首次请求
   ↓
2. 创建服务器进程
   ↓
3. 初始化 JSON-RPC 连接
   ↓
4. 发送 initialize 请求
   ↓
5. 发送 initialized 通知
   ↓
6. 客户端就绪
   ↓
7. 处理后续请求
   ↓
8. OpenCode 关闭
   ↓
9. 发送 shutdown 请求
   ↓
10. 终止进程
```

---

## 最佳实践

### 1. 使用防抖等待诊断

```typescript
// 推荐做法
await LSP.touchFile(file, true) // 等待诊断完成

// 避免直接操作
await LSP.touchFile(file, false) // 立即返回，诊断可能未完成
```

### 2. 处理多个 LSP 服务器

同一文件可能由多个 LSP 服务器支持（如 TypeScript 和 ESLint）：

```typescript
// results 会包含所有服务器的诊断
const results = await LSP.diagnostics()
// {
//   "file.ts": [
//     { source: "typescript", ... },
//     { source: "eslint", ... }
//   ]
// }
```

### 3. 错误处理

LSP 操作可能失败，应该优雅处理：

```typescript
try {
  const defs = await LSP.definition(position)
  // 处理结果
} catch (err) {
  // 处理错误（服务器不可用、初始化失败等）
}
```

### 4. 性能优化

- **复用客户端**：系统会自动复用已存在的客户端
- **并行请求**：多个 LSP 请求会并行执行
- **诊断防抖**：避免频繁触发诊断

### 5. 调试 LSP 问题

启用详细日志：

```bash
opencode --log-level DEBUG
```

查看 LSP 服务器状态：

```bash
opencode lsp status
```

---

## 故障排除

### 常见问题

#### 1. LSP 服务器未启动

**症状**：LSP 功能报错 "No LSP server available"

**解决方案**：

- 检查文件扩展名是否被支持
- 检查项目根目录是否被正确识别
- 查看日志确认服务器启动失败原因
- 尝试手动安装 LSP 服务器

#### 2. 诊断信息不更新

**症状**：修改文件后诊断信息未更新

**解决方案**：

- 确保使用 `LSP.touchFile(file, true)` 等待诊断
- 检查 LSP 服务器是否正常运行
- 查看日志确认诊断事件是否被接收

#### 3. 初始化超时

**症状**：LSP 客户端初始化时超时（45秒）

**解决方案**：

- 检查 LSP 服务器是否可执行
- 检查网络连接（某些服务器需要下载依赖）
- 尝试增加超时时间（修改 `client.ts` 中的 `45_000`）

#### 4. 服务器进程未终止

**症状**：OpenCode 关闭后 LSP 进程仍在运行

**解决方案**：

- 检查 `shutdown` 方法是否被调用
- 查看 `process.kill()` 是否成功
- 尝试手动清理进程

#### 5. 自定义 LSP 服务器无法启动

**症状**：自定义 LSP 配置不生效

**解决方案**：

- 验证 `command` 数组格式正确
- 检查命令路径是否为绝对路径
- 验证环境变量格式
- 查看日志确认启动错误

### 调试技巧

#### 查看 LSP 连接状态

```bash
# 查看所有 LSP 服务器状态
opencode lsp status
```

#### 查看日志

```bash
# 启用 DEBUG 级别日志
opencode --print-logs --log-level DEBUG

# 查找特定服务器的日志
opencode --print-logs 2>&1 | grep "lsp.server.python"
```

#### 手动测试 LSP 服务器

```bash
# 测试 LSP 服务器是否可以启动
gopls --stdio

# 发送初始化请求（需要构造 JSON-RPC 消息）
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}' | gopls
```

---

## 总结

OpenCode 的 LSP 层提供了强大而灵活的代码智能功能：

1. **全面的语言支持**：内置 20+ 种编程语言的 LSP 服务器
2. **自动化管理**：自动发现、启动、管理 LSP 客户端
3. **性能优化**：连接复用、诊断防抖、并行请求
4. **易于扩展**：支持自定义 LSP 服务器配置
5. **与工具集成**：通过 `lsp` 工具暴露给 AI Agent

通过 LSP 层，OpenCode 能够提供 IDE 级别的代码理解能力，使 AI Agent 能够更智能地操作和分析代码。

---

## 相关文档

- [04-工具系统详解.md](./04-工具系统详解.md)
- [07-会话管理详解.md](./07-会话管理详解.md)
- [36-IDE集成.md](./36-IDE集成.md)

---

_最后更新：2026-01-21_
