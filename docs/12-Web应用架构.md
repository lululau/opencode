# Web 应用架构详解

## 目录

1. [概述](#概述)
2. [技术栈](#技术栈)
3. [应用架构](#应用架构)
4. [目录结构](#目录结构)
5. [核心模块](#核心模块)
6. [状态管理](#状态管理)
7. [路由设计](#路由设计)
8. [实时通信](#实时通信)
9. [组件系统](#组件系统)
10. [构建配置](#构建配置)
11. [性能优化](#性能优化)
12. [开发实践](#开发实践)

---

## 概述

OpenCode Web 应用是基于 SolidJS 构建的现代化单页应用（SPA），通过与 OpenCode Server 的 HTTP/WebSocket 连接，提供完整的 AI 编码助手功能。应用采用模块化设计，支持多项目、多会话、实时事件流和复杂的状态管理。

### 主要特性

- **响应式 UI**：基于 SolidJS 的细粒度响应式系统
- **实时通信**：通过 SSE/WebSocket 与服务器保持长连接
- **状态管理**：使用 SolidJS Store 和响应式 Primitives
- **国际化**：支持 10+ 种语言的完整本地化
- **主题系统**：支持亮色/暗色/系统主题，以及自定义主题
- **多项目管理**：支持同时打开多个项目和工作空间
- **离线缓存**：基于 IndexedDB 的持久化存储
- **性能优化**：消息预取、虚拟滚动、懒加载

---

## 技术栈

### 核心框架

| 技术                     | 版本   | 用途           |
| ------------------------ | ------ | -------------- |
| **SolidJS**              | 1.9.10 | 响应式 UI 框架 |
| **@solidjs/router**      | -      | 客户端路由     |
| **@solidjs/meta**        | -      | 文档头部管理   |
| **solid-js/store**       | -      | 状态管理       |
| **@solid-primitives/\*** | 多个   | 响应式原语库   |

### UI 组件库

| 技术                      | 版本         | 用途               |
| ------------------------- | ------------ | ------------------ |
| **@opencode-ai/ui**       | workspace:\* | 共享 UI 组件库     |
| **@kobalte/core**         | 0.13.11      | 无障碍 UI 基础组件 |
| **Tailwind CSS**          | 4.1.11       | 样式系统           |
| **@tailwindcss/vite**     | -            | Vite 插件          |
| **virtua**                | -            | 虚拟滚动列表       |
| **@thisbeyond/solid-dnd** | 0.7.5        | 拖放功能           |

### 工具库

| 技术                                  | 版本       | 用途                    |
| ------------------------------------- | ---------- | ----------------------- |
| **@solid-primitives/event-bus**       | 1.1.2      | 事件总线                |
| **@solid-primitives/storage**         | catalog:\* | 存储原语                |
| **@solid-primitives/resize-observer** | 2.1.3      | 尺寸监听                |
| **@solid-primitives/scroll**          | 2.1.3      | 滚动控制                |
| **@solid-primitives/media**           | 2.3.3      | 媒体查询                |
| **@solid-primitives/i18n**            | 2.2.1      | 国际化                  |
| **@solid-primitives/audio**           | 1.4.2      | 音频播放                |
| **fuzzysort**                         | catalog:\* | 模糊搜索                |
| **marked** + **shiki**                | catalog:\* | Markdown 渲染和代码高亮 |
| **diff**                              | catalog:\* | 文本差异比较            |
| **luxon**                             | catalog:\* | 日期时间处理            |
| **remeda**                            | catalog:\* | 函数式工具库            |
| **zod**                               | catalog:\* | 运行时验证              |

### 构建工具

| 技术                  | 版本       | 用途               |
| --------------------- | ---------- | ------------------ |
| **Vite**              | 7.1.4      | 开发服务器和打包器 |
| **vite-plugin-solid** | catalog:\* | SolidJS 集成       |
| **TypeScript**        | catalog:\* | 类型检查           |

### 开发工具

| 技术                              | 版本    | 用途         |
| --------------------------------- | ------- | ------------ |
| **@playwright/test**              | 1.57.0  | E2E 测试     |
| **@happy-dom/global-registrator** | 20.0.11 | DOM 测试环境 |

---

## 应用架构

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        应用入口层                              │
│  ┌──────────────┐    ┌──────────────┐   ┌──────────────┐   │
│  │  index.html │ -> │  app.tsx     │ -> │  entry.tsx  │   │
│  └──────────────┘    └──────────────┘   └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Provider 层                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AppBaseProviders                                      │  │
│  │  ├─ MetaProvider (文档头部)                           │  │
│  │  ├─ ThemeProvider (主题管理)                           │  │
│  │  ├─ LanguageProvider (国际化)                          │  │
│  │  ├─ DialogProvider (对话框系统)                        │  │
│  │  ├─ MarkedProvider (Markdown 渲染)                    │  │
│  │  ├─ DiffComponentProvider (差异组件)                    │  │
│  │  └─ CodeComponentProvider (代码组件)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AppInterface                                         │  │
│  │  ├─ ServerProvider (服务器连接)                        │  │
│  │  ├─ GlobalSDKProvider (全局 SDK 客户端)                │  │
│  │  └─ GlobalSyncProvider (全局状态同步)                   │  │
│  │      └─ SettingsProvider                               │  │
│  │      └─ PermissionProvider                             │  │
│  │      └─ LayoutProvider                                │  │
│  │      └─ NotificationProvider                           │  │
│  │      └─ CommandProvider                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       路由层                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  @solidjs/router                                     │  │
│  │  ├─ Route "/" -> Home (主页)                          │  │
│  │  └─ Route "/:dir" -> DirectoryLayout (项目布局)      │  │
│  │       ├─ Route "/" -> Redirect to session                │  │
│  │       └─ Route "/session/:id" -> Session (会话)         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       页面层                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │   Home   │  │ Layout   │  │ Session  │               │
│  │ (项目列表)│  │ (主布局)  │  │ (会话)   │               │
│  └──────────┘  └──────────┘  └──────────┘               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Context 层                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │ Server    │  │ GlobalSDK  │  │ SDK        │          │
│  │ (服务器)  │  │ (全局SDK) │  │ (目录SDK)  │          │
│  └────────────┘  └────────────┘  └────────────┘          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │ Sync      │  │ Layout     │  │ Settings   │          │
│  │ (状态同步)│  │ (布局)     │  │ (设置)     │          │
│  └────────────┘  └────────────┘  └────────────┘          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │ Platform  │  │ Terminal   │  │ Prompt     │          │
│  │ (平台)    │  │ (终端)     │  │ (提示词)   │          │
│  └────────────┘  └────────────┘  └────────────┘          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │ File      │  │ Permission │  │ Command    │          │
│  │ (文件)    │  │ (权限)     │  │ (命令)     │          │
│  └────────────┘  └────────────┘  └────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       组件层                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐     │
│  │  Dialogs    │  │  Session     │  │  Terminal   │     │
│  │  (对话框)    │  │  (会话)      │  │  (终端)     │     │
│  └──────────────┘  └──────────────┘  └─────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐     │
│  │  FileTree   │  │  Settings    │  │  PromptInput│     │
│  │  (文件树)    │  │  (设置)      │  │  (提示输入) │     │
│  └──────────────┘  └──────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SDK 层（外部）                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  @opencode-ai/sdk/v2/client                          │  │
│  │  ├─ createOpencodeClient()                            │  │
│  │  ├─ HTTP/REST API                                   │  │
│  │  └─ SSE Event Stream                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户交互
    │
    ▼
组件事件 (onClick, onChange, etc.)
    │
    ▼
Context 方法 (useContext().method())
    │
    ▼
Store 更新 (setStore() / createSignal())
    │
    ├─> 本地状态更新 (响应式 UI 重新渲染)
    │
    ▼
SDK 调用 (globalSDK.client.method())
    │
    ▼
HTTP 请求 (POST/GET/DELETE)
    │
    ▼
OpenCode Server
    │
    ▼
SSE 事件流 (实时推送)
    │
    ▼
GlobalSDK 事件分发
    │
    ▼
GlobalSync Store 更新
    │
    ▼
组件重新渲染 (响应式)
```

---

## 目录结构

```
packages/app/
├── src/
│   ├── app.tsx                    # 应用主入口
│   ├── entry.tsx                  # 渲染入口
│   ├── env.d.ts                   # 环境变量类型
│   ├── index.css                   # 全局样式
│   ├── index.ts                   # 导出入口
│   │
│   ├── components/                # 组件库
│   │   ├── dialog-*.tsx         # 各种对话框组件
│   │   │   ├── dialog-connect-provider.tsx
│   │   │   ├── dialog-edit-project.tsx
│   │   │   ├── dialog-fork.tsx
│   │   │   ├── dialog-manage-models.tsx
│   │   │   ├── dialog-select-*.tsx
│   │   │   └── dialog-settings.tsx
│   │   ├── file-tree.tsx         # 文件树组件
│   │   ├── model-tooltip.tsx     # 模型提示
│   │   ├── prompt-input.tsx      # 提示输入组件
│   │   ├── session/             # 会话相关组件
│   │   │   ├── session-context-tab.tsx
│   │   │   ├── session-header.tsx
│   │   │   ├── session-new-view.tsx
│   │   │   ├── session-sortable-tab.tsx
│   │   │   └── session-sortable-terminal-tab.tsx
│   │   ├── session-context-usage.tsx
│   │   ├── session-lsp-indicator.tsx
│   │   ├── session-mcp-indicator.tsx
│   │   ├── settings-*.tsx       # 设置页面组件
│   │   ├── terminal.tsx          # 终端组件
│   │   └── titlebar.tsx         # 标题栏
│   │
│   ├── context/                 # Context 层
│   │   ├── command.tsx          # 命令系统
│   │   ├── file.tsx             # 文件操作
│   │   ├── global-sdk.tsx       # 全局 SDK
│   │   ├── global-sync.tsx      # 全局状态同步
│   │   ├── language.tsx         # 国际化
│   │   ├── layout.tsx           # 布局管理
│   │   ├── local.tsx           # 本地存储
│   │   ├── notification.tsx     # 通知系统
│   │   ├── permission.tsx       # 权限管理
│   │   ├── platform.tsx         # 平台 API
│   │   ├── prompt.tsx           # 提示词状态
│   │   ├── sdk.tsx              # 目录级 SDK
│   │   ├── server.tsx           # 服务器连接
│   │   ├── settings.tsx         # 设置状态
│   │   ├── sync.tsx             # 状态同步
│   │   └── terminal.tsx         # 终端状态
│   │
│   ├── pages/                   # 页面组件
│   │   ├── directory-layout.tsx  # 项目布局
│   │   ├── error.tsx            # 错误页面
│   │   ├── home.tsx             # 主页（项目列表）
│   │   ├── layout.tsx           # 主布局
│   │   └── session.tsx          # 会话页面
│   │
│   ├── hooks/                   # 自定义 Hooks
│   │   └── use-providers.ts
│   │
│   ├── i18n/                    # 国际化翻译
│   │   ├── da.ts               # 丹麦语
│   │   ├── de.ts               # 德语
│   │   ├── en.ts               # 英语
│   │   ├── es.ts               # 西班牙语
│   │   ├── fr.ts               # 法语
│   │   ├── ja.ts               # 日语
│   │   ├── ko.ts               # 韩语
│   │   ├── pl.ts               # 波兰语
│   │   ├── ru.ts               # 俄语
│   │   ├── zh.ts               # 简体中文
│   │   └── zht.ts              # 繁体中文
│   │
│   ├── utils/                   # 工具函数
│   │   ├── dom.ts              # DOM 操作
│   │   ├── id.ts               # ID 生成
│   │   ├── perf.ts             # 性能监控
│   │   ├── persist.ts          # 持久化工具
│   │   ├── prompt.ts           # 提示词处理
│   │   ├── same.ts             # 相等性检查
│   │   ├── solid-dnd.tsx       # 拖放工具
│   │   ├── sound.ts            # 音频处理
│   │   └── speech.ts           # 语音输入
│   │
│   └── addons/                 # 插件/扩展
│       ├── serialize.ts         # 序列化工具
│       └── serialize.test.ts   # 单元测试
│
├── public/                      # 静态资源
├── e2e/                        # E2E 测试
│   └── playwright.spec.ts
├── index.html                   # HTML 入口
├── package.json                # 包配置
├── tsconfig.json              # TypeScript 配置
├── vite.config.ts             # Vite 配置
├── vite.js                   # Vite 插件配置
├── playwright.config.ts       # Playwright 配置
├── happydom.ts               # Happy-DOM 配置
└── README.md                 # 说明文档
```

---

## 核心模块

### 1. 应用入口（app.tsx）

`app.tsx` 是 Web 应用的根组件，负责：

#### Provider 层级

```tsx
<ServerProvider>                    // 服务器连接管理
  <GlobalSDKProvider>              // 全局 SDK 客户端
    <GlobalSyncProvider>            // 全局状态同步
      <SettingsProvider>            // 用户设置
        <PermissionProvider>        // 权限控制
          <LayoutProvider>         // 布局状态
            <NotificationProvider>  // 通知系统
              <CommandProvider>    // 命令系统
                <Router>          // 路由
```

#### 基础 Providers（AppBaseProviders）

```tsx
<MetaProvider>           // 文档头部（title, meta）
  <ThemeProvider>        // 主题管理（亮色/暗色）
    <LanguageProvider>   // 国际化（语言切换）
      <UiI18nBridge>   // UI 国际化桥接
        <ErrorBoundary>
          <DialogProvider>
            <MarkedProvider>           // Markdown 渲染
              <DiffComponentProvider>   // 差异显示组件
                <CodeComponentProvider> // 代码显示组件
```

### 2. 路由系统

使用 `@solidjs/router` 进行客户端路由：

```tsx
<Router>
  <Route path="/" component={Home} />

  <Route path="/:dir" component={DirectoryLayout}>
    <Route path="/" component={() => <Navigate href="session" />} />
    <Route path="/session/:id?" component={(p) => <Session id={p.params.id} />} />
  </Route>
</Router>
```

#### 路由说明

| 路由                | 组件              | 说明                           |
| ------------------- | ----------------- | ------------------------------ |
| `/`                 | `Home`            | 主页，显示项目列表             |
| `/:dir`             | `DirectoryLayout` | 项目布局（目录已 Base64 编码） |
| `/:dir/session/`    | `Session`         | 新建会话                       |
| `/:dir/session/:id` | `Session`         | 指定会话                       |

### 3. Context 层

Context 是应用的核心，每个 Context 管理特定的功能域。

#### ServerProvider（context/server.tsx）

**职责**：

- 管理服务器连接
- 存储服务器列表
- 健康检查
- 项目列表管理

**核心代码**：

```tsx
export const { use: useServer, provider: ServerProvider } = createSimpleContext({
  name: "Server",
  init: (props: { defaultUrl: string }) => {
    const [active, setActive] = createSignal("")
    const [healthy, setHealthy] = createSignal<boolean | undefined>(undefined)

    // 健康检查
    const check = (url: string) => {
      const sdk = createOpencodeClient({
        baseUrl: url,
        signal: AbortSignal.timeout(3000),
      })
      return sdk.global
        .health()
        .then((x) => x.data?.healthy === true)
        .catch(() => false)
    }

    // 每 10 秒检查一次
    createEffect(() => {
      const url = active()
      const run = () => {
        check(url).then((next) => setHealthy(next))
      }
      run()
      const interval = setInterval(run, 10_000)
      onCleanup(() => clearInterval(interval))
    })

    return {
      url: active(),
      name: serverDisplayName(active()),
      healthy,
      isLocal: origin() === "local",
      projects: {
        list: projectsList(),
        open: (directory) => {
          /* ... */
        },
        close: (directory) => {
          /* ... */
        },
        last: () => store.lastProject[key](),
      },
    }
  },
})
```

#### GlobalSDKProvider（context/global-sdk.tsx）

**职责**：

- 创建全局 SDK 客户端
- 管理全局事件流（SSE）
- 事件队列和节流

**核心代码**：

```tsx
export const { use: useGlobalSDK, provider: GlobalSDKProvider } = createSimpleContext({
  name: "GlobalSDK",
  init: () => {
    const abort = new AbortController()

    // 创建事件流客户端
    const eventSdk = createOpencodeClient({
      baseUrl: server.url,
      signal: abort.signal,
    })

    const emitter = createGlobalEmitter<{ [key: string]: Event }>()

    // 事件队列和节流（16ms）
    let queue: Array<{ directory: string; payload: Event } | undefined> = []
    const coalesced = new Map<string, number>()
    let timer: ReturnType<typeof setTimeout> | undefined

    const flush = () => {
      const events = queue
      queue = []
      batch(() => {
        for (const event of events) {
          emitter.emit(event.directory, event.payload)
        }
      })
    }

    // 监听全局事件流
    void (async () => {
      const events = await eventSdk.global.event()
      for await (const event of events.stream) {
        const directory = event.directory ?? "global"
        const payload = event.payload

        // 事件合并（避免重复更新）
        const k = key(directory, payload)
        if (k) {
          const i = coalesced.get(k)
          if (i !== undefined) queue[i] = undefined
          coalesced.set(k, queue.length)
        }

        queue.push({ directory, payload })
        schedule()
      }
    })()

    // 返回 SDK 实例
    return {
      url: server.url,
      client: createOpencodeClient({ baseUrl: server.url }),
      event: emitter,
    }
  },
})
```

#### GlobalSyncProvider（context/global-sync.tsx）

**职责**：

- 管理全局数据同步
- 处理服务器事件并更新 Store
- 管理子实例（每个项目一个）
- 数据持久化

**核心数据结构**：

```tsx
type State = {
  status: "loading" | "partial" | "complete"
  agent: Agent[]
  command: Command[]
  project: string
  provider: ProviderListResponse
  config: Config
  path: Path
  session: Session[]
  sessionTotal: number
  session_status: { [sessionID: string]: SessionStatus }
  session_diff: { [sessionID: string]: FileDiff[] }
  todo: { [sessionID: string]: Todo[] }
  permission: { [sessionID: string]: PermissionRequest[] }
  question: { [sessionID: string]: QuestionRequest[] }
  mcp: { [name: string]: McpStatus }
  lsp: LspStatus[]
  vcs: VcsInfo | undefined
  limit: number
  message: { [sessionID: string]: Message[] }
  part: { [messageID: string]: Part[] }
}
```

**事件处理**：

```tsx
const unsub = globalSDK.event.listen((e) => {
  const directory = e.name
  const event = e.details
  const [store, setStore] = children[directory]

  switch (event.type) {
    case "session.created":
      // 添加新会话
      setStore(
        "session",
        produce((draft) => {
          draft.splice(result.index, 0, event.properties.info)
        }),
      )
      break

    case "session.updated":
      // 更新会话（或归档删除）
      if (event.properties.info.time.archived) {
        setStore(
          "session",
          produce((draft) => {
            draft.splice(result.index, 1)
          }),
        )
      } else {
        setStore("session", result.index, reconcile(event.properties.info))
      }
      break

    case "message.updated":
      // 添加或更新消息
      setStore("message", sessionID, result.index, reconcile(info))
      break

    case "message.part.updated":
      // 添加或更新消息部分
      setStore("part", part.messageID, result.index, reconcile(part))
      break

    case "permission.asked":
      // 新权限请求
      setStore(
        "permission",
        sessionID,
        produce((draft) => {
          draft.splice(result.index, 0, event.properties)
        }),
      )
      break
    // ... 更多事件类型
  }
})
```

#### SDKProvider（context/sdk.tsx）

**职责**：

- 为特定目录创建 SDK 客户端
- 过滤全局事件到目录级别
- 提供 `client` 和 `event` 访问

**核心代码**：

```tsx
export const { use: useSDK, provider: SDKProvider } = createSimpleContext({
  name: "SDK",
  init: (props: { directory: string }) => {
    const globalSDK = useGlobalSDK()

    // 创建目录级 SDK 客户端
    const sdk = createOpencodeClient({
      baseUrl: globalSDK.url,
      fetch: platform.fetch,
      directory: props.directory,
      throwOnError: true,
    })

    // 目录级事件发射器
    const emitter = createGlobalEmitter<{
      [key in Event["type"]]: Extract<Event, { type: key }>
    }>()

    // 订阅全局事件并过滤
    const unsub = globalSDK.event.on(props.directory, (event) => {
      emitter.emit(event.type, event)
    })

    return {
      directory: props.directory,
      client: sdk,
      event: emitter,
      url: globalSDK.url,
    }
  },
})
```

#### 其他 Context

| Context                | 文件                       | 职责                               |
| ---------------------- | -------------------------- | ---------------------------------- |
| `LayoutProvider`       | `context/layout.tsx`       | 布局状态（侧边栏、工作区、标签页） |
| `SettingsProvider`     | `context/settings.tsx`     | 用户设置（主题、语言、键位）       |
| `PermissionProvider`   | `context/permission.tsx`   | 权限规则和自动响应                 |
| `NotificationProvider` | `context/notification.tsx` | 通知系统（权限、错误、会话）       |
| `CommandProvider`      | `context/command.tsx`      | 命令系统（命令注册、执行）         |
| `LanguageProvider`     | `context/language.tsx`     | 国际化（语言切换、翻译）           |
| `TerminalProvider`     | `context/terminal.tsx`     | 终端状态和管理                     |
| `PromptProvider`       | `context/prompt.tsx`       | 提示词状态（输入历史）             |
| `FileProvider`         | `context/file.tsx`         | 文件选择和行范围                   |
| `PlatformProvider`     | `context/platform.tsx`     | 平台 API（桌面/浏览器）            |

---

## 状态管理

### 1. SolidJS Store

OpenCode 广泛使用 `createStore` 来管理复杂状态，特别是 `global-sync.tsx`。

#### Store 优势

- **嵌套响应式**：深层对象和数组的响应式更新
- **细粒度更新**：只有变化的属性会触发重新渲染
- **性能优化**：比多个 `createSignal` 更高效

#### 示例

```tsx
// 创建 Store
const [store, setStore] = createStore<State>({
  status: "loading",
  session: [],
  message: {},
})

// 更新单个属性
setStore("status", "complete")

// 更新嵌套属性
setStore("session", 0, "title", "New Title")

// 使用 reconcile 高效更新数组
setStore("session", reconcile(newSessions, { key: "id" }))

// 使用 produce 进行复杂更新
setStore(
  "session",
  produce((draft) => {
    draft.splice(0, 1)
    draft.push(newSession)
  }),
)
```

### 2. 响应式 Primitives

#### createSignal

用于简单的独立状态：

```tsx
const [value, setValue] = createSignal("")

// 使用时自动追踪依赖
const doubled = createMemo(() => value() * 2)

// 更新
setValue(newValue)
```

#### createMemo

派生状态，自动缓存：

```tsx
const currentProject = createMemo(() => {
  const directory = params.dir ? base64Decode(params.dir) : undefined
  if (!directory) return

  const projects = layout.projects.list()
  return projects.find((p) => p.worktree === directory)
})
```

#### createEffect

副作用处理：

```tsx
createEffect(() => {
  const url = server.url
  if (!url) return

  // 副作用
  console.log("Server URL changed:", url)
  fetchData(url)
})

// 带依赖追踪
createEffect(
  on(
    () => [params.dir, params.id],
    ([dir, id]) => {
      console.log("Route changed:", dir, id)
    },
    { defer: true },
  ),
)
```

#### batch

批量更新以减少重新渲染：

```tsx
batch(() => {
  setStore("status", "complete")
  setStore("session", reconcile(newSessions))
  setStore("message", messageID, newMessages)
})
```

### 3. 状态同步架构

```
Server (SSE Event)
    │
    ▼
GlobalSDK.event (事件分发)
    │
    ├─> 全局事件
    │   │
    │   └─> GlobalSync Store (全局状态)
    │       ├─ project
    │       ├─ provider
    │       └─ config
    │
    └─> 目录事件
        │
        └─> GlobalSync.child(directory) Store (目录状态)
            ├─ session
            ├─ message
            ├─ permission
            └─ ...
```

### 4. 持久化存储

使用 `@solid-primitives/storage` 进行持久化：

```tsx
// utils/persist.ts
import { createStorage } from "@solid-primitives/storage"

export const Persist = {
  global(key: string, version: string[]) {
    return createStorage(localStorage, `opencode:${key}`, {
      version: version[0],
    })
  },

  workspace(directory: string, key: string, version: string[]) {
    const hashed = base64Encode(directory)
    return createStorage(localStorage, `opencode:${hashed}:${key}`, {
      version: version[0],
    })
  },
}

// 使用
const [store, setStore, , ready] = persisted(Persist.global("layout", ["layout.v1"]), createStore(initialState))
```

---

## 路由设计

### 1. 路由结构

```tsx
<Router
  root={(props) => (
    <SettingsProvider>
      <PermissionProvider>
        <LayoutProvider>
          <NotificationProvider>
            <CommandProvider>
              <Layout>{props.children}</Layout>
            </CommandProvider>
          </NotificationProvider>
        </LayoutProvider>
      </PermissionProvider>
    </SettingsProvider>
  )}
>
  <Route
    path="/"
    component={() => (
      <Suspense fallback={<Loading />}>
        <Home />
      </Suspense>
    )}
  />

  <Route path="/:dir" component={DirectoryLayout}>
    <Route path="/" component={() => <Navigate href="session" />} />
    <Route
      path="/session/:id?"
      component={(p) => (
        <Show when={p.params.id ?? "new"} keyed>
          <TerminalProvider>
            <FileProvider>
              <PromptProvider>
                <Suspense fallback={<Loading />}>
                  <Session />
                </Suspense>
              </PromptProvider>
            </FileProvider>
          </TerminalProvider>
        </Show>
      )}
    />
  </Route>
</Router>
```

### 2. 嵌套路由

- **Layout**：提供侧边栏、项目列表等共享 UI
- **DirectoryLayout**：提供特定项目的布局
- **Session**：会话页面，包含多个标签页

### 3. 参数处理

```tsx
const params = useParams()

// 获取 Base64 编码的目录
const directory = params.dir ? base64Decode(params.dir) : undefined

// 获取会话 ID
const sessionId = params.id
```

### 4. 导航

```tsx
import { useNavigate } from "@solidjs/router"
import { A } from "@solidjs/router"

// 编程式导航
const navigate = useNavigate()
navigate("/new/path")

// 声明式链接
<A href="/project/session/abc123">Go to session</A>
```

---

## 实时通信

### 1. SSE (Server-Sent Events)

OpenCode 使用 SSE 进行服务器到客户端的实时事件推送。

#### GlobalSDK 事件流

```tsx
void (async () => {
  const events = await eventSdk.global.event()
  for await (const event of events.stream) {
    const directory = event.directory ?? "global"
    const payload = event.payload

    // 处理事件
    handleEvent(directory, payload)
  }
})()
```

#### 事件类型

| 事件类型                   | 说明           | 处理           |
| -------------------------- | -------------- | -------------- |
| `global.disposed`          | 服务器实例重启 | 重新加载数据   |
| `project.updated`          | 项目信息更新   | 更新项目列表   |
| `server.instance.disposed` | 项目实例重启   | 重新启动实例   |
| `session.created`          | 新会话创建     | 添加到会话列表 |
| `session.updated`          | 会话信息更新   | 更新或删除会话 |
| `message.updated`          | 新消息或更新   | 添加/更新消息  |
| `message.part.updated`     | 消息部分更新   | 添加/更新部分  |
| `message.removed`          | 消息删除       | 从列表中删除   |
| `permission.asked`         | 权限请求       | 显示通知       |
| `permission.replied`       | 权限响应       | 从列表中删除   |
| `question.asked`           | 问题请求       | 显示通知       |
| `question.replied`         | 问题响应       | 从列表中删除   |
| `session.status`           | 会话状态更新   | 更新状态指示器 |
| `vcs.branch.updated`       | 分支更新       | 更新分支信息   |
| `lsp.updated`              | LSP 状态更新   | 刷新 LSP 状态  |

### 2. 事件队列和节流

为了避免高频率事件导致的性能问题，GlobalSDK 实现了事件队列和节流：

```tsx
// 16ms 节流（60fps）
const schedule = () => {
  if (timer) return
  const elapsed = Date.now() - last
  timer = setTimeout(flush, Math.max(0, 16 - elapsed))
}

// 事件合并（避免重复）
const key = (directory: string, payload: Event) => {
  if (payload.type === "session.status") {
    return `session.status:${directory}:${payload.properties.sessionID}`
  }
  if (payload.type === "message.part.updated") {
    return `message.part.updated:${directory}:${part.messageID}:${part.id}`
  }
}
```

### 3. 目录级事件过滤

SDKProvider 过滤全局事件到特定目录：

```tsx
const unsub = globalSDK.event.on(props.directory, (event) => {
  emitter.emit(event.type, event)
})
```

### 4. 事件总线

使用 `@solid-primitives/event-bus` 创建事件总线：

```tsx
import { createGlobalEmitter } from "@solid-primitives/event-bus"

const emitter = createGlobalEmitter<{
  [key in Event["type"]]: Extract<Event, { type: key }>
}>()

// 发射事件
emitter.emit("session.created", event)

// 监听事件
const unsub = emitter.on("session.created", (event) => {
  console.log("Session created:", event)
})
```

---

## 组件系统

### 1. 共享 UI 组件库（@opencode-ai/ui）

共享组件位于 `packages/ui/`，包含：

- **基础组件**：Button, Input, Select, Dialog, Tooltip
- **布局组件**：Tabs, SplitPane, ResizeHandle
- **数据组件**：Avatar, MessageNav, Spinner
- **功能组件**：SessionTurn, SessionReview, DiffChanges
- **Code 组件**：Code, Diff
- **上下文**：DialogProvider, ThemeProvider, I18nProvider

### 2. 应用特定组件

#### Dialogs

- `DialogConnectProvider`：连接 AI 提供商
- `DialogEditProject`：编辑项目名称
- `DialogFork`：创建分支
- `DialogManageModels`：管理模型
- `DialogSelect*`：各种选择对话框

#### Session 组件

- `SessionHeader`：会话头部（标题、状态）
- `SessionContextTab`：会话上下文标签页
- `SessionSortableTab`：可排序的标签页
- `SessionNewView`：新建会话视图

#### Settings 组件

- `SettingsGeneral`：通用设置
- `SettingsAgents`：代理设置
- `SettingsModels`：模型设置
- `SettingsProviders`：提供商设置
- `SettingsPermissions`：权限设置
- `SettingsCommands`：命令设置
- `SettingsKeybinds`：快捷键设置
- `SettingsMcp`：MCP 设置

### 3. 组件模式

#### 可拖放组件

使用 `@thisbeyond/solid-dnd`：

```tsx
<DragDropProvider>
  <DragDropSensors />
  <SortableProvider ids={sessionIds()} strategy={closestCenter}>
    <For each={sessions()}>
      {(session) => (
        <SortableTab id={session.id} onDragStart={handleDragStart} onDragOver={handleDragOver}>
          {session.title}
        </SortableTab>
      )}
    </For>
  </SortableProvider>
  <DragOverlay />
</DragDropProvider>
```

#### 虚拟滚动

使用 `virtua`：

```tsx
import { useVirtualizer } from "virtua"

const items = createMemo(() => store.session)

const virtualizer = useVirtualizer({
  count: items().length,
  getScrollElement: () => scrollRef,
  estimateSize: () => 40,
})

<For each={virtualizer.getVirtualItems()}>
  {(virtualItem) => {
    const item = items()[virtualItem.index]
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          transform: `translateY(${virtualItem.offsetTop}px)`,
        }}
      >
        {item.title}
      </div>
    )
  }}
</For>
```

#### 延迟加载

使用 SolidJS 的 `lazy` 和 `Suspense`：

```tsx
const Home = lazy(() => import("@/pages/home"))
const Session = lazy(() => import("@/pages/session"))

<Suspense fallback={<Loading />}>
  <Home />
</Suspense>
```

---

## 构建配置

### 1. Vite 配置（vite.config.ts）

```typescript
import { defineConfig } from "vite"
import desktopPlugin from "./vite"

export default defineConfig({
  plugins: [desktopPlugin] as any,
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
  },
  build: {
    target: "esnext",
  },
})
```

### 2. Vite 插件（vite.js）

```javascript
import solidPlugin from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "url"

export default [
  {
    name: "opencode-desktop:config",
    config() {
      return {
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
          },
        },
        worker: {
          format: "es",
        },
      }
    },
  },
  tailwindcss(),
  solidPlugin(),
]
```

### 3. TypeScript 配置（tsconfig.json）

```json
{
  "extends": "@tsconfig/bun",
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 4. 环境变量

```bash
# 开发环境
VITE_OPENCODE_SERVER_HOST=localhost
VITE_OPENCODE_SERVER_PORT=4096
```

### 5. 构建脚本

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "serve": "vite preview",
    "test": "playwright test",
    "test:e2e:local": "bun script/e2e-local.ts",
    "typecheck": "tsgo -b"
  }
}
```

---

## 性能优化

### 1. 消息预取

在 `layout.tsx` 中实现会话消息预取：

```tsx
const prefetchChunk = 600
const prefetchConcurrency = 1
const prefetchPendingLimit = 6

const prefetchSession = (session: Session, priority: "high" | "low" = "low") => {
  const directory = session.directory
  if (!directory) return

  const [store] = globalSync.child(directory)
  if (store.message[session.id] !== undefined) return

  // 添加到队列
  const q = queueFor(directory)
  if (q.inflight.has(session.id)) return
  if (q.pendingSet.has(session.id)) return

  if (priority === "high") q.pending.unshift(session.id)
  if (priority !== "high") q.pending.push(session.id)
  q.pendingSet.add(session.id)

  // 限制队列大小
  while (q.pending.length > prefetchPendingLimit) {
    q.pending.pop()
  }

  pumpPrefetch(directory)
}
```

### 2. 事件合并

避免高频率事件导致的重复更新：

```tsx
const coalesced = new Map<string, number>()

const key = (directory: string, payload: Event) => {
  if (payload.type === "session.status") {
    return `session.status:${directory}:${payload.properties.sessionID}`
  }
  if (payload.type === "message.part.updated") {
    return `message.part.updated:${directory}:${part.messageID}:${part.id}`
  }
}

const k = key(directory, payload)
if (k) {
  const i = coalesced.get(k)
  if (i !== undefined) queue[i] = undefined // 删除旧事件
  coalesced.set(k, queue.length)
}
```

### 3. 细粒度响应式

使用 `untrack` 避免不必要的依赖追踪：

```tsx
const currentSessions = createMemo(() => {
  const project = currentProject()
  if (!project) return []

  const dirs = workspaceIds(project)
  const result: Session[] = []

  for (const dir of dirs) {
    const expanded = untrack(() => store.workspaceExpanded[dir] ?? dir === project.worktree)
    if (!expanded) continue

    const [dirStore] = globalSync.child(dir)
    const dirSessions = dirStore.session
      .filter((session) => session.directory === dirStore.path.directory)
      .toSorted(sortSessions)
    result.push(...dirSessions)
  }

  return result
})
```

### 4. 批量更新

使用 `batch` 减少重新渲染：

```tsx
batch(() => {
  setStore("status", "complete")
  setStore("session", reconcile(newSessions, { key: "id" }))
  setStore("message", sessionID, reconcile(newMessages, { key: "id" }))
})
```

### 5. reconcile 高效更新数组

使用 `reconcile` 进行高效数组更新：

```tsx
setStore("session", reconcile(newSessions, { key: "id" }))

// 等价于：
// 1. 按 key 比较新旧数组
// 2. 只更新变化的部分
// 3. 重用不变的元素
```

### 6. 懒加载和代码分割

使用 SolidJS 的 `lazy`：

```tsx
const Home = lazy(() => import("@/pages/home"))
const Session = lazy(() => import("@/pages/session"))
```

### 7. 虚拟滚动

对长列表使用虚拟滚动（`virtua`）：

```tsx
const virtualizer = useVirtualizer({
  count: items().length,
  getScrollElement: () => scrollRef,
  estimateSize: () => 40,
  overscan: 10,
})
```

---

## 开发实践

### 1. 项目初始化

```bash
# 克隆仓库
git clone https://github.com/anomalyco/opencode.git
cd opencode

# 安装依赖
bun install

# 启动开发服务器
bun dev
```

### 2. 本地开发

```bash
# 启动 opencode 服务器
cd packages/opencode
bun run --conditions=browser ./src/index.ts serve --port 4096

# 启动 Web 应用（另一个终端）
cd packages/app
bun dev -- --port 4444

# 访问 http://localhost:4444
```

### 3. 添加新 Context

```tsx
// context/my-context.tsx
import { createSimpleContext } from "@opencode-ai/ui/context"
import { createSignal } from "solid-js"

export const { use: useMyContext, provider: MyProvider } = createSimpleContext({
  name: "MyContext",
  init: () => {
    const [value, setValue] = createSignal("")

    return {
      value,
      setValue,
    }
  },
})
```

### 4. 添加新组件

```tsx
// components/my-component.tsx
import { createSignal } from "solid-js"

export function MyComponent(props: { title: string }) {
  const [count, setCount] = createSignal(0)

  return (
    <div>
      <h1>{props.title}</h1>
      <p>Count: {count()}</p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
    </div>
  )
}
```

### 5. 添加新页面

```tsx
// pages/my-page.tsx
export default function MyPage() {
  return (
    <div>
      <h1>My Page</h1>
      {/* 内容 */}
    </div>
  )
}

// 在 app.tsx 中添加路由
import { lazy } from "solid-js"

const MyPage = lazy(() => import("@/pages/my-page"))

<Route path="/my-page" component={() => (
  <Suspense fallback={<Loading />}>
    <MyPage />
  </Suspense>
)} />
```

### 6. 调试技巧

#### 使用 Bun Inspector

```bash
bun run --inspect=ws://localhost:6499/ dev
```

#### VSCode 调试配置

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Bun",
      "address": "localhost",
      "port": 6499,
      "restart": true,
      "sourceMaps": true,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "${workspaceFolder}"
    }
  ]
}
```

#### 日志输出

```tsx
createEffect(() => {
  const data = someSignal()
  console.log("Data changed:", data)
})
```

### 7. 测试

#### 单元测试

```tsx
import { describe, it, expect } from "bun:test"
import { render } from "@testing-library/solid"
import { MyComponent } from "./my-component"

describe("MyComponent", () => {
  it("renders title", () => {
    const { getByText } = render(() => <MyComponent title="Hello" />)
    expect(getByText("Hello")).toBeInTheDocument()
  })
})
```

#### E2E 测试

```tsx
import { test, expect } from "@playwright/test"

test("navigation", async ({ page }) => {
  await page.goto("http://localhost:3000")
  await expect(page.locator("h1")).toHaveText("OpenCode")
})
```

---

## 总结

OpenCode Web 应用是一个基于 SolidJS 的现代化单页应用，具有以下特点：

1. **模块化架构**：清晰的分层结构（Provider -> Context -> Component）
2. **响应式状态管理**：使用 SolidJS Store 和 Primitives
3. **实时通信**：基于 SSE 的事件流系统
4. **性能优化**：消息预取、事件合并、虚拟滚动
5. **国际化**：支持 10+ 种语言
6. **主题系统**：完整的亮色/暗色/自定义主题支持
7. **开发体验**：热重载、TypeScript、Vite 构建

通过理解这些架构模式和最佳实践，开发者可以更容易地扩展和维护 OpenCode Web 应用。

---

_文档版本：1.0.0_
_最后更新：2026-01-22_
