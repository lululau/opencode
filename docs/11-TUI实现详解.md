# TUI 实现详解

## 目录

1. [架构概述](#架构概述)
2. [核心框架](#核心框架)
3. [目录结构](#目录结构)
4. [入口与初始化](#入口与初始化)
5. [状态管理](#状态管理)
6. [组件系统](#组件系统)
7. [路由系统](#路由系统)
8. [终端渲染](#终端渲染)
9. [键盘交互](#键盘交互)
10. [主题系统](#主题系统)
11. [服务通信](#服务通信)
12. [实时更新](#实时更新)
13. [布局管理](#布局管理)
14. [性能优化](#性能优化)
15. [开发实践](#开发实践)

---

## 架构概述

OpenCode 的终端用户界面（TUI）基于 **SolidJS** 和 **OpenTUI** 框架构建，提供高性能、响应式的终端应用体验。

### 技术栈

| 技术               | 版本   | 用途           |
| ------------------ | ------ | -------------- |
| **SolidJS**        | 1.9.10 | 响应式 UI 框架 |
| **@opentui/solid** | 0.1.74 | 终端 UI 组件库 |
| **@opentui/core**  | 0.1.74 | OpenTUI 核心   |
| **TypeScript**     | 5.8.2  | 类型系统       |

### 架构层次

```
┌─────────────────────────────────────────────────────────────────┐
│                      应用层                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   Home   │  │  Session  │  │ Dialogs  │       │
│  │  Route   │  │  Route   │  │ (Overlays)│       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
└───────┼────────────┼─────────────┼──────────────────────┘
        │            │             │
        └────────────┼─────────────┘
                     │
        ┌────────────┴────────────┐
        │     组件层          │
        │  Prompt │ Header │ Sidebar │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │    上下文层        │
        │ SDK │ Sync │ Local │ Theme │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │   框架层       │
        │   SolidJS + OpenTUI  │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │   渲染层        │
        │ Terminal Renderer (60fps)│
        └───────────────────────────┘
```

---

## 核心框架

### OpenTUI 集成

OpenTUI 是一个基于 SolidJS 的终端 UI 框架，提供 React 风格的组件 API 和终端原生渲染能力。

#### 核心导入

```tsx
import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { TextAttributes, RGBA } from "@opentui/core"
```

#### 主要组件类型

| 组件类型              | 用途                           |
| --------------------- | ------------------------------ |
| `BoxRenderable`       | 基础布局容器                   |
| `ScrollBoxRenderable` | 可滚动的内容区域               |
| `TextareaRenderable`  | 多行文本输入（如提示词输入框） |
| `Renderable`          | 渲染对象的通用接口             |

#### 文本属性与颜色

```typescript
// 粗体文本
<text attributes={TextAttributes.BOLD}>Bold text</text>

// 自定义颜色
<box backgroundColor={RGBA.fromHex("#ff0000")}>
  Red background
</box>
```

---

## 目录结构

TUI 实现位于 `packages/opencode/src/cli/cmd/tui/`，共包含 **64+** 个文件。

```
packages/opencode/src/cli/cmd/tui/
├── app.tsx              # TUI 入口，主应用组件
├── attach.ts            # TUI 附加到现有服务器
├── event.ts             # TUI 事件定义（BusEvent）
├── thread.ts            # 线程处理逻辑
├── worker.ts            # Worker 进程，处理 RPC 请求
│
├── routes/              # 路由组件
│   ├── home.tsx        # 主页（会话列表）
│   └── session/        # 会话详情路由
│       ├── index.tsx    # 会话主视图
│       ├── header.tsx   # 会话头部（代理信息、状态）
│       ├── sidebar.tsx  # 会话侧边栏（子会话）
│       ├── footer.tsx   # 会话底部（快捷键提示）
│       ├── permission.tsx # 权限请求对话框
│       ├── question.tsx  # 问题请求对话框
│       └── ...
│
├── component/           # 可复用组件
│   ├── prompt/         # 提示词输入组件
│   │   ├── index.tsx     # 主输入框
│   │   ├── autocomplete.tsx # 自动补全
│   │   ├── history.tsx    # 历史记录
│   │   ├── stash.tsx      # 临时存储
│   │   └── frecency.tsx   # 频率排序
│   ├── dialog-*.tsx     # 对话框组件
│   ├── tips.tsx        # 提示组件
│   └── ...
│
├── context/             # 上下文提供者
│   ├── sdk.tsx         # SDK 客户端上下文
│   ├── sync.tsx        # 数据同步上下文
│   ├── local.tsx       # 本地状态上下文
│   ├── theme.tsx       # 主题上下文
│   ├── keybind.tsx     # 键盘绑定上下文
│   ├── route.tsx       # 路由上下文
│   ├── exit.tsx        # 退出处理
│   ├── kv.tsx          # 键值存储上下文
│   ├── args.tsx        # 命令行参数
│   ├── prompt.tsx      # 提示词引用
│   └── theme/         # 主题定义
│       ├── opencode.json
│       ├── dracula.json
│       ├── catppuccin.json
│       └── ...（30+ 个主题）
│
├── ui/                 # 基础 UI 组件
│   ├── dialog.tsx      # 对话框容器
│   ├── dialog-alert.tsx # 警告对话框
│   ├── dialog-confirm.tsx # 确认对话框
│   ├── dialog-help.tsx   # 帮助对话框
│   ├── toast.tsx       # 提示通知
│   └── ...
│
└── util/               # 工具函数
    ├── clipboard.ts     # 剪贴板操作
    └── editor.ts       # 编辑器工具
```

---

## 入口与初始化

### TUI 启动流程

```typescript
export function tui(input: {
  url: string
  args: Args
  directory?: string
  fetch?: typeof fetch
  events?: EventSource
  onExit?: () => Promise<void>
})
```

#### 1. 终端背景检测

```typescript
async function getTerminalBackgroundColor(): Promise<"dark" | "light"> {
  // 通过 ANSI 转义码查询终端背景颜色
  process.stdout.write("\x1b]11;?\x07")

  // 解析 RGB 值并计算亮度
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // 根据亮度阈值确定主题模式
  return luminance > 0.5 ? "light" : "dark"
}
```

#### 2. OpenTUI 渲染器初始化

```typescript
render(
  () => <App />,
  {
    targetFps: 60,           // 60 FPS 目标帧率
    gatherStats: false,       // 禁用性能统计
    exitOnCtrlC: false,      // 禁用默认 Ctrl+C 退出
    useKittyKeyboard: {},     // 启用 Kitty 键盘协议
    consoleOptions: {
      keyBindings: [{ name: "y", ctrl: true, action: "copy-selection" }],
      onCopySelection: (text) => {
        Clipboard.copy(text).catch((error) => {
          console.error(`Failed to copy: ${error}`)
        })
      },
    },
  },
)
```

#### 3. 上下文提供者层级

```tsx
<ErrorBoundary>
  <ArgsProvider {...input.args}>
    <ExitProvider onExit={onExit}>
      <KVProvider>
        <ToastProvider>
          <RouteProvider>
            <SDKProvider url={input.url} directory={input.directory}>
              <SyncProvider>
                <ThemeProvider mode={mode}>
                  <LocalProvider>
                    <KeybindProvider>
                      <PromptStashProvider>
                        <DialogProvider>
                          <CommandProvider>
                            <FrecencyProvider>
                              <PromptHistoryProvider>
                                <PromptRefProvider>
                                  <App />
                                </PromptRefProvider>
                              </PromptHistoryProvider>
                            </FrecencyProvider>
                          </CommandProvider>
                        </DialogProvider>
                      </PromptStashProvider>
                    </KeybindProvider>
                  </LocalProvider>
                </ThemeProvider>
              </SyncProvider>
            </SDKProvider>
          </RouteProvider>
        </ToastProvider>
      </KVProvider>
    </ExitProvider>
  </ArgsProvider>
</ErrorBoundary>
```

每个提供者封装特定功能，形成清晰的依赖层次。

---

## 状态管理

TUI 使用多层状态管理策略，结合 SolidJS 的响应式系统和自定义存储。

### 响应式原语

#### 1. 信号（Signals）

```typescript
import { createSignal } from "solid-js"

const [conceal, setConceal] = createSignal(true)
const [showThinking, setShowThinking] = kv.signal("thinking_visibility", true)
```

#### 2. 记忆（Memos）

```typescript
import { createMemo } from "solid-js"

const session = createMemo(() => sync.session.get(route.sessionID))
const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])
```

#### 3. 存储（Stores）

```typescript
import { createStore } from "solid-js/store"

const [modelStore, setModelStore] = createStore<{
  ready: boolean
  recent: { providerID: string; modelID: string }[]
  favorite: { providerID: string; modelID: string }[]
}>({
  ready: false,
  recent: [],
  favorite: [],
})

// 批量更新
batch(() => {
  setModelStore("ready", true)
  setModelStore("recent", [...modelStore.recent, newModel])
})
```

### Sync Store（中央状态存储）

```typescript
// 定义完整的数据模型
const [store, setStore] = createStore<{
  status: "loading" | "partial" | "complete"
  provider: Provider[]
  agent: Agent[]
  command: Command[]
  permission: { [sessionID: string]: PermissionRequest[] }
  question: { [sessionID: string]: QuestionRequest[] }
  config: Config
  session: Session[]
  session_status: { [sessionID: string]: SessionStatus }
  session_diff: { [sessionID: string]: Snapshot.FileDiff[] }
  todo: { [sessionID: string]: Todo[] }
  message: { [sessionID: string]: Message[] }
  part: { [messageID: string]: Part[] }
  lsp: LspStatus[]
  mcp: { [key: string]: McpStatus }
  formatter: FormatterStatus[]
  vcs: VcsInfo | undefined
  path: Path
}>({ ...initialState })
```

### 状态更新策略

#### 批量更新（Batch）

```typescript
// 所有状态更新在单个渲染周期内完成
batch(() => {
  setStore("provider", [...newProviders])
  setStore("agent", [...newAgents])
  setStore("status", "complete")
})
```

#### 生产式更新（Produce）

```typescript
// Immer 风格的不可变更新
setStore(
  "session",
  produce((sessions) => {
    const index = sessions.findIndex((s) => s.id === newSession.id)
    if (index !== -1) {
      sessions[index] = newSession
    } else {
      sessions.push(newSession)
    }
  }),
)
```

#### 协调（Reconcile）

```typescript
// 智能合并数组，保留引用
setStore("message", route.sessionID, reconcile(newMessages))
```

---

## 组件系统

### 上下文提供者（Context Providers）

#### SDK Context

```typescript
export const { use: useSDK, provider: SDKProvider } = createSimpleContext({
  name: "SDK",
  init: (props) => {
    const abort = new AbortController()
    const sdk = createOpencodeClient({
      baseUrl: props.url,
      directory: props.directory,
      signal: abort.signal,
    })

    // 事件流订阅
    onMount(async () => {
      const events = await sdk.event.subscribe({}, { signal: abort.signal })
      for await (const event of events.stream) {
        handleEvent(event)
      }
    })

    return { client: sdk, event: emitter, url: props.url }
  },
})
```

#### Sync Context

```typescript
export const { use: useSync, provider: SyncProvider } = createSimpleContext({
  name: "Sync",
  init: () => {
    const [store, setStore] = createStore<SyncStore>({ ...initialState })

    // 提供便捷的访问方法
    const result = {
      data: store,
      session: {
        get(id: string) {
          return store.session.find((s) => s.id === id)
        },
        async sync(id: string) {
          const session = await sdk.session.get({ sessionID: id })
          setStore("session", reconcile([...store.session, session]))
        },
      },
    }

    return result
  },
})
```

#### Theme Context

```typescript
export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: "Theme",
  init: (props: { mode: "dark" | "light" }) => {
    const themes = {
      opencode,
      dracula,
      catppuccin,
      nord, // ... 30+ 个主题
    }

    const [themeName, setThemeName] = createSignal("opencode")
    const [mode, setMode] = createSignal<"dark" | "light">(props.mode)

    const theme = createMemo(() => {
      const base = themes[themeName()]
      return {
        ...base,
        // 应用模式覆盖
        background: mode() === "dark" ? base.backgroundDark : base.backgroundLight,
      }
    })

    return { theme, mode, setTheme: setThemeName, setMode }
  },
})
```

#### Keybind Context

```typescript
export const { use: useKeybind, provider: KeybindProvider } = createSimpleContext({
  name: "Keybind",
  init: () => {
    const sync = useSync()
    const [store, setStore] = createStore({ leader: false })

    // Leader 键机制
    useKeyboard(async (evt) => {
      if (!store.leader && match("leader", evt)) {
        setStore("leader", true)
        // 2 秒后自动取消 leader 状态
        setTimeout(() => {
          if (store.leader) setStore("leader", false)
        }, 2000)
      }
    })

    return {
      parse(evt: ParsedKey): Keybind.Info {
        return Keybind.fromParsedKey(evt, store.leader)
      },
      match(key: string, evt: ParsedKey): boolean {
        const keybind = keybinds()[key]
        return keybind.some((k) => Keybind.match(k, this.parse(evt)))
      },
    }
  },
})
```

### 对话框系统（Dialog System）

```typescript
// Dialog 容器组件
export function Dialog(
  props: ParentProps<{
    size?: "medium" | "large"
    onClose: () => void
  }>
) {
  const dimensions = useTerminalDimensions()
  const { theme } = useTheme()
  const renderer = useRenderer()

  return (
    <box
      width={dimensions().width}
      height={dimensions().height}
      backgroundColor={RGBA.fromInts(0, 0, 0, 150)} // 半透明遮罩
      alignItems="center"
      paddingTop={dimensions().height / 4}
    >
      <box
        width={props.size === "large" ? 80 : 60}
        backgroundColor={theme.backgroundPanel}
        paddingTop={1}
      >
        {props.children}
      </box>
    </box>
  )
}

// Dialog 提供者（管理对话框栈）
export function DialogProvider(props: ParentProps) {
  const [store, setStore] = createStore({
    stack: [] as { element: JSX.Element; onClose?: () => void }[],
    size: "medium" as "medium" | "large",
  })

  // ESC 键关闭对话框
  useKeyboard((evt) => {
    if (evt.name === "escape" && store.stack.length > 0) {
      const current = store.stack.at(-1)!
      current.onClose?.()
      setStore("stack", store.stack.slice(0, -1))
      evt.preventDefault()
      refocus()
    }
  })

  return (
    <ctx.Provider value={value}>
      {props.children}
      <Show when={value.stack.length}>
        <Dialog onClose={() => value.clear()} size={value.size}>
          {value.stack.at(-1)!.element}
        </Dialog>
      </Show>
    </ctx.Provider>
  )
}
```

### 提示词组件（Prompt Component）

```typescript
export function Prompt(props: PromptProps) {
  let input: TextareaRenderable
  const keybind = useKeybind()
  const local = useLocal()
  const sdk = useSDK()
  const route = useRoute()
  const sync = useSync()
  const { theme } = useTheme()

  // 多行文本输入框
  return (
    <textarea
      ref={input!}
      value={prompt.text}
      onInput={(e) => setPrompt("text", e.target.value)}
      placeholder="Enter your prompt..."
      backgroundColor={theme.background}
      foreground={theme.text}
      padding={[0, 1]}
      onPaste={(e: PasteEvent) => {
        handlePaste(e)
      }}
    />
  )
}
```

---

## 路由系统

TUI 使用简单的基于状态的路由系统，支持两种主要路由类型。

### 路由定义

```typescript
type Route =
  | { type: "home" }
  | {
      type: "session"
      sessionID: string
      initialPrompt?: string
    }

// 路由上下文
export const { use: useRoute, provider: RouteProvider } = createSimpleContext({
  name: "Route",
  init: () => {
    const [data, setData] = createSignal<Route>({ type: "home" })

    return {
      data,
      navigate(route: Route) {
        setData(route)
      },
    }
  },
})
```

### 路由切换

```tsx
function App() {
  const route = useRoute()

  return (
    <Switch>
      <Match when={route.data.type === "home"}>
        <Home />
      </Match>
      <Match when={route.data.type === "session"}>
        <Session />
      </Match>
    </Switch>
  )
}
```

### 路由数据访问

```typescript
function HomeRoute() {
  const route = useRouteData("home")
  const sync = useSync()

  // 自动按更新时间排序
  const sessions = createMemo(() =>
    sync.data.session
      .toSorted((a, b) => b.time.updated - a.time.updated)
  )

  return <SessionList sessions={sessions()} />
}

function SessionRoute() {
  const route = useRouteData("session")
  const sync = useSync()

  const session = createMemo(() =>
    sync.session.get(route.sessionID)
  )

  const messages = createMemo(() =>
    sync.data.message[route.sessionID] ?? []
  )

  return <SessionView session={session()} messages={messages()} />
}
```

---

## 终端渲染

### 渲染流程

OpenTUI 采用帧驱动的渲染系统，以 60 FPS 的目标帧率持续更新终端。

#### 1. 布局计算

```typescript
function App() {
  const dimensions = useTerminalDimensions()
  const theme = useTheme()

  return (
    <box
      width={dimensions().width}
      height={dimensions().height}
      backgroundColor={theme.background}
    >
      {/* 内容 */}
    </box>
  )
}
```

#### 2. 终端尺寸响应

```typescript
// 自动响应终端尺寸变化
createEffect(() => {
  const width = dimensions().width
  const height = dimensions().height

  // 根据尺寸调整布局
  const sidebarVisible = width > 120
  const contentWidth = width - (sidebarVisible ? 42 : 0)
})
```

#### 3. 滚动加速

```typescript
// macOS 风格的滚动加速
class MacOSScrollAccel implements ScrollAcceleration {
  constructor(private velocity = 0) {}

  tick(now?: number): number {
    this.velocity *= 0.85 // 摩擦系数
    if (Math.abs(this.velocity) < 0.5) this.velocity = 0
    return this.velocity
  }

  reset(): void {
    this.velocity = 0
  }
}

// 固定速度滚动
class CustomSpeedScroll implements ScrollAcceleration {
  constructor(private speed: number) {}

  tick(_now?: number): number {
    return this.speed
  }

  reset(): void {}
}
```

### 文本渲染

#### 基础文本组件

```tsx
<text fg={theme.text}>Plain text</text>
<text attributes={TextAttributes.BOLD}>Bold text</text>
<text attributes={TextAttributes.DIM} fg={theme.textMuted}>
  Dimmed text
</text>
```

#### 颜色应用

```typescript
import { RGBA } from "@opentui/core"

// 从十六进制创建颜色
const red = RGBA.fromHex("#ff0000")

// 从 RGB 值创建颜色
const blue = RGBA.fromInts(0, 0, 255, 255)

// 带透明度的颜色
const semiTransparent = RGBA.fromInts(0, 0, 0, 150)
```

#### 文本选择与复制

```typescript
const renderer = useRenderer()

// 自动选择复制
<box
  onMouseUp={async () => {
    if (renderer.getSelection()) return
    const text = renderer.getSelection()?.getSelectedText()
    if (text && text.length > 0) {
      await Clipboard.copy(text)
      toast.show({ message: "Copied to clipboard", variant: "info" })
      renderer.clearSelection()
    }
  }}
>
  {/* 内容 */}
</box>

// Ctrl+Y 手动复制
renderer.console.onCopySelection = async (text: string) => {
  await Clipboard.copy(text)
    .then(() => toast.show({ message: "Copied", variant: "info" }))
    .catch(toast.error)
  renderer.clearSelection()
}
```

### 终端标题

```typescript
// 根据会话动态更新终端标题
createEffect(() => {
  if (route.data.type === "home") {
    renderer.setTerminalTitle("OpenCode")
    return
  }

  if (route.data.type === "session") {
    const session = sync.session.get(route.data.sessionID)
    const title = session?.title || "OpenCode"
    const truncated = title.length > 40 ? title.slice(0, 37) + "..." : title
    renderer.setTerminalTitle(`OC | ${truncated}`)
  }
})
```

---

## 键盘交互

### 全局键盘处理

```typescript
function App() {
  useKeyboard((evt) => {
    // Ctrl+C 退出（可选）
    if (evt.ctrl && evt.name === "c") {
      handleExit()
    }

    // ESC 关闭对话框
    if (evt.name === "escape" && dialog.stack.length > 0) {
      dialog.clear()
    }
  })
}
```

### Leader 键机制

Leader 键是一种高级键盘绑定机制，允许通过两键组合快速执行命令。

```typescript
// Leader 键激活
useKeyboard(async (evt) => {
  if (!store.leader && match("leader", evt)) {
    setStore("leader", true)
    // 2 秒后自动取消
    setTimeout(() => {
      if (store.leader) setStore("leader", false)
    }, 2000)
  }

  // Leader 状态下的按键
  if (store.leader && evt.name) {
    setImmediate(() => {
      // 恢复焦点
      leader(false)
    })
  }
})
```

### 键盘绑定解析

```typescript
function parse(evt: ParsedKey): Keybind.Info {
  // 特殊处理 Ctrl+Underscore（表示为 \x1F）
  if (evt.name === "\x1F") {
    return Keybind.fromParsedKey({ ...evt, name: "_", ctrl: true }, store.leader)
  }

  return Keybind.fromParsedKey(evt, store.leader)
}

function match(key: string, evt: ParsedKey): boolean {
  const keybind = keybinds()[key]
  if (!keybind) return false

  const parsed = parse(evt)
  return keybind.some((k) => Keybind.match(k, parsed))
}
```

### 键盘绑定打印

```typescript
function print(key: string): string {
  const first = keybinds()[key]?.at(0)
  if (!first) return ""

  const result = Keybind.toString(first)
  // 替换 <leader> 占位符
  return result.replace("<leader>", Keybind.toString(keybinds().leader![0]!))
}

// 示例输出
print("agent.cycle") // "<Space>a"
print("session.new") // "<Ctrl>n"
print("model_list") // "<leader>m"
```

### 组件焦点管理

```typescript
const renderer = useRenderer()
let focus: Renderable | null

// Leader 模式下保存焦点
function leader(active: boolean) {
  if (active) {
    setStore("leader", true)
    focus = renderer.currentFocusedRenderable
    focus?.blur()
    return
  }

  // 恢复焦点
  if (!active && focus) {
    focus.focus()
  }
  setStore("leader", false)
}
```

---

## 主题系统

TUI 支持深色和浅色模式，并提供 30+ 预设主题。

### 主题数据结构

```typescript
type ThemeColors = {
  // 基础颜色
  primary: RGBA
  secondary: RGBA
  accent: RGBA
  error: RGBA
  warning: RGBA
  success: RGBA
  info: RGBA

  // 文本颜色
  text: RGBA
  textMuted: RGBA

  // 背景颜色
  background: RGBA
  backgroundPanel: RGBA
  backgroundElement: RGBA
  backgroundMenu: RGBA

  // 边框颜色
  border: RGBA
  borderActive: RGBA
  borderSubtle: RGBA

  // Diff 颜色
  diffAdded: RGBA
  diffRemoved: RGBA
  diffContext: RGBA
  diffAddedBg: RGBA
  diffRemovedBg: RGBA
  diffContextBg: RGBA

  // Markdown 颜色
  markdownText: RGBA
  markdownHeading: RGBA
  markdownLink: RGBA
  markdownCode: RGBA

  // 语法高亮颜色
  syntaxComment: RGBA
  syntaxKeyword: RGBA
  syntaxFunction: RGBA
  syntaxString: RGBA
  syntaxNumber: RGBA
  syntaxType: RGBA
}
```

### 主题切换

```typescript
function ThemeDialog() {
  const { theme, mode, setTheme, setMode } = useTheme()
  const themes = Object.keys(themes)

  return (
    <dialog>
      <text>Current: {theme.name}</text>
      <text>Mode: {mode()}</text>

      <For each={themes}>
        {(name) => (
          <box
            onMouseUp={() => setTheme(name)}
            backgroundColor={theme.name === name ? theme.primary : undefined}
          >
            <text>{name}</text>
          </box>
        )}
      </For>
    </dialog>
  )
}
```

### 动态主题加载

```typescript
import opencode from "./theme/opencode.json" with { type: "json" }
import dracula from "./theme/dracula.json" with { type: "json" }
// ... 30+ 个主题

const themes = {
  opencode,
  dracula,
  catppuccin,
  nord,
  // ...
}
```

### 模式切换

```typescript
// 深色/浅色模式切换
function toggleMode() {
  const current = mode()
  setMode(current === "dark" ? "light" : "dark")
}

// 自动检测终端背景
async function getTerminalBackgroundColor(): Promise<"dark" | "light"> {
  // ... 查询终端并解析 RGB
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "light" : "dark"
}
```

---

## 服务通信

TUI 通过 TypeScript SDK 与 OpenCode 服务器通信。

### SDK 客户端初始化

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk/v2"

const sdk = createOpencodeClient({
  baseUrl: "http://opencode.internal",
  directory: process.cwd(),
  signal: abort.signal,
})
```

### API 调用示例

```typescript
// 获取会话列表
const sessions = await sdk.session.list({})

// 获取单个会话
const session = await sdk.session.get({ sessionID: "ses_abc123" })

// 创建会话
const newSession = await sdk.session.create({
  prompt: "Hello, world!",
})

// 发送提示
await sdk.session.prompt({
  sessionID: "ses_abc123",
  text: "Help me write code",
})
```

### 错误处理

```typescript
sdk.event.on("error", (evt) => {
  const error = evt.properties.error

  toast.show({
    variant: "error",
    message: error.message || "An error occurred",
    duration: 5000,
  })
})
```

---

## 实时更新

TUI 使用 Server-Sent Events (SSE) 接收实时事件更新。

### 事件流订阅

```typescript
onMount(async () => {
  while (true) {
    if (abort.signal.aborted) break

    // 订阅服务器事件流
    const events = await sdk.event.subscribe({}, { signal: abort.signal })

    for await (const event of events.stream) {
      handleEvent(event)
    }
  }
})
```

### 事件批处理

```typescript
let queue: Event[] = []
let timer: Timer | undefined
let last = 0

const flush = () => {
  if (queue.length === 0) return
  const events = queue
  queue = []
  timer = undefined
  last = Date.now()

  // 批量发射事件以减少渲染次数
  batch(() => {
    for (const event of events) {
      emitter.emit(event.type, event)
    }
  })
}

const handleEvent = (event: Event) => {
  queue.push(event)
  const elapsed = Date.now() - last

  if (timer) return

  // 16ms（60fps）内的延迟批处理
  if (elapsed < 16) {
    timer = setTimeout(flush, 16)
    return
  }

  // 否则立即处理以减少延迟
  flush()
}
```

### 事件类型

```typescript
// 会话相关
sdk.event.on("session.created", (evt) => {
  setStore("session", reconcile([...store.session, evt.properties.info]))
})

sdk.event.on("session.updated", (evt) => {
  setStore(
    "session",
    produce((sessions) => {
      const index = sessions.findIndex((s) => s.id === evt.properties.info.id)
      if (index !== -1) sessions[index] = evt.properties.info
    }),
  )
})

// 消息相关
sdk.event.on("message.created", (evt) => {
  const { sessionID, info } = evt.properties
  setStore("message", sessionID, (msgs) => [...msgs, info])
})

sdk.event.on("message.part.updated", (evt) => {
  const { messageID, part } = evt.properties
  setStore("part", messageID, (parts) => reconcile([...parts, part]))
})
```

---

## 布局管理

### 响应式布局

```typescript
const dimensions = useTerminalDimensions()
const wide = createMemo(() => dimensions().width > 120)

const sidebarVisible = createMemo(() => {
  if (session()?.parentID) return false // 子会话不显示侧边栏
  if (sidebarOpen()) return true // 手动打开
  if (sidebar() === "auto" && wide()) return true // 宽屏自动显示
  return false
})

const contentWidth = createMemo(() => dimensions().width - (sidebarVisible() ? 42 : 0) - 4)
```

### Flex 布局

```tsx
<box flexDirection="column" gap={1} width="100%">
  {/* 头部 */}
  <box height={1}>
    <Header />
  </box>

  {/* 主内容区 */}
  <box flexDirection="row" flex={1}>
    <box flex={1}>
      <Messages />
    </box>

    <Show when={sidebarVisible()}>
      <box width={42}>
        <Sidebar />
      </box>
    </Show>
  </box>

  {/* 底部 */}
  <box height={1}>
    <Footer />
  </box>
</box>
```

### 滚动管理

```typescript
// 自定义滚动加速
const scrollAcceleration = createMemo(() => {
  const tui = sync.data.config.tui

  if (tui?.scroll_acceleration?.enabled) {
    return new MacOSScrollAccel()
  }

  if (tui?.scroll_speed) {
    return new CustomSpeedScroll(tui.scroll_speed)
  }

  return new CustomSpeedScroll(3)  // 默认速度
})

// 应用到滚动框
<scrollbox
  height={height}
  scrollAcceleration={scrollAcceleration()}
>
  {/* 内容 */}
</scrollbox>
```

---

## 性能优化

### 渲染优化

#### 1. 批量更新

```typescript
// 避免多次渲染
batch(() => {
  setStore("message", sessionID, messages)
  setStore("part", messageID, parts)
  setStore("todo", sessionID, todos)
})
```

#### 2. 记忆化（Memoization）

```typescript
// 缓存计算结果
const sortedSessions = createMemo(() => sessions().toSorted((a, b) => b.time.updated - a.time.updated))

const visibleMessages = createMemo(() => messages().filter((m) => !m.concealed))
```

#### 3. 协调（Reconciliation）

```typescript
// 智能数组合并，保留引用
setStore("message", sessionID, reconcile(newMessages))
```

### 事件批处理

```typescript
// 16ms 批处理窗口
const handleEvent = (event: Event) => {
  queue.push(event)
  const elapsed = Date.now() - last

  if (elapsed < 16) {
    // 等待更多事件
    timer = setTimeout(flush, 16)
  } else {
    // 立即处理
    flush()
  }
}
```

### 懒加载

```typescript
// 会话数据按需加载
createEffect(async () => {
  const sessionID = route.sessionID
  if (!sessionID) return

  await sync.session
    .sync(sessionID)
    .then(() => {
      if (scroll) scroll.scrollBy(100_000)
    })
    .catch((e) => {
      console.error(e)
      toast.show({ message: `Session not found: ${sessionID}`, variant: "error" })
      navigate({ type: "home" })
    })
})
```

---

## 开发实践

### 添加新的对话框组件

```typescript
// 1. 创建对话框组件
export function DialogMyFeature() {
  const { theme } = useTheme()
  const dialog = useDialog()

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.text}>My Feature</text>
      <box onMouseUp={() => dialog.clear()}>
        <text>Close</text>
      </box>
    </box>
  )
}

// 2. 注册命令
const command = useCommandDialog()

command.register(() => [
  {
    title: "Open My Feature",
    value: "myfeature.open",
    keybind: "myfeature_open",
    category: "Feature",
    onSelect: () => {
      dialog.replace(() => <DialogMyFeature />)
    },
  },
])

// 3. 添加到键盘绑定配置
// 在用户配置中：
{
  "keybinds": {
    "myfeature_open": ["<leader>f"]
  }
}
```

### 添加新的上下文

```typescript
// 1. 定义上下文
export const { use: useMyContext, provider: MyProvider } = createSimpleContext({
  name: "MyContext",
  init: () => {
    const [value, setValue] = createSignal("default")

    return {
      value,
      set: setValue,
      reset: () => setValue("default"),
    }
  },
})

// 2. 添加到应用提供者
<ArgsProvider>
  <ExitProvider>
    {/* ... */}
    <MyProvider>
      <App />
    </MyProvider>
  </ExitProvider>
</ArgsProvider>

// 3. 在组件中使用
function MyComponent() {
  const { value, set } = useMyContext()

  return (
    <box onMouseUp={() => set("new value")}>
      <text>{value()}</text>
    </box>
  )
}
```

### 自定义主题

```json
{
  "name": "my-theme",
  "mode": "dark",
  "colors": {
    "primary": "#ff6b6b",
    "secondary": "#4ecdc4",
    "accent": "#ffe66d",
    "background": "#1a1a2e",
    "backgroundPanel": "#16213e",
    "text": "#eaeaea",
    "textMuted": "#8a8a8a",
    "border": "#0f3460",
    "borderActive": "#533483"
  }
}
```

### 调试技巧

#### 1. 启用调试面板

```typescript
const renderer = useRenderer()

function toggleDebug() {
  renderer.toggleDebugOverlay()
}
```

#### 2. 启用控制台

```typescript
renderer.console.toggle()
```

#### 3. 堆快照

```typescript
import { writeHeapSnapshot } from "v8"

const path = writeHeapSnapshot()
toast.show({
  variant: "info",
  message: `Heap snapshot written to ${path}`,
  duration: 5000,
})
```

#### 4. 打印日志

```bash
# 启用日志输出
opencode --print-logs

# 设置日志级别
opencode --log-level DEBUG
```

---

## 最佳实践

### 1. 组件设计

- **单一职责**：每个组件只做一件事
- **可复用性**：通过 props 参数化组件
- **上下文隔离**：使用上下文提供者共享状态

### 2. 性能

- **批量更新**：使用 `batch()` 减少渲染次数
- **记忆化**：使用 `createMemo()` 缓存计算结果
- **懒加载**：按需加载会话数据

### 3. 用户体验

- **响应式布局**：自动适应终端尺寸
- **键盘友好**：提供键盘快捷键
- **视觉反馈**：使用 toast 和对话框提供反馈

### 4. 错误处理

- **错误边界**：使用 ErrorBoundary 捕获渲染错误
- **事件处理**：统一处理 API 错误
- **优雅降级**：提供默认值和备用方案

---

## 相关资源

- [OpenTUI 文档](https://github.com/sst/opentui)
- [SolidJS 文档](https://solidjs.com)
- [API 参考](./46-API参考.md)
- [配置系统](./30-配置系统深度解析.md)

---

_文档版本：1.0.0_
_最后更新：2026-01-22_
