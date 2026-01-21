# SolidJS 入门学习指南

> 基于 OpenCode 项目的实际代码经验

## 目录

- [简介](#简介)
- [核心概念](#核心概念)
- [响应式系统](#响应式系统)
- [组件基础](#组件基础)
- [状态管理](#状态管理)
- [生命周期](#生命周期)
- [实战示例](#实战示例)
- [最佳实践](#最佳实践)
- [常用生态系统](#常用生态系统)

---

## 简介

SolidJS 是一个现代化的响应式 JavaScript UI 库，具有以下特点：

- **细粒度响应式**：基于信号的响应式系统，无需虚拟 DOM
- **高性能**：渲染性能接近原生 JavaScript
- **类 React API**：熟悉的 JSX 和组件语法
- **TypeScript 友好**：完整的类型支持
- **体积小**：打包后仅约 6KB

### OpenCode 项目中的 SolidJS 版本

```json
{
  "solid-js": "catalog:",
  "@solidjs/router": "catalog:",
  "@solidjs/meta": "catalog:"
}
```

---

## 核心概念

### 1. 响应式系统（Reactivity）

SolidJS 的响应式系统基于**细粒度更新**，这意味着只有实际发生变化的部分才会重新渲染。

#### 创建信号（Signal）

信号是 SolidJS 最基础的响应式单元：

```typescript
import { createSignal } from "solid-js"

function Counter() {
  const [count, setCount] = createSignal(0)

  return (
    <div>
      <p>Count: {count()}</p>
      <button onClick={() => setCount(count() + 1)}>Increment</button>
    </div>
  )
}
```

**OpenCode 实例** - 来自 `components/status-popover.tsx`：

```typescript
const [store, setStore] = createStore({
  status: {} as Record<string, ServerStatus | undefined>,
  loading: null as string | null,
  defaultServerUrl: undefined as string | undefined,
})
```

### 2. 创建派生状态（Memo）

使用 `createMemo` 创建派生值，自动缓存直到依赖变化：

```typescript
import { createMemo } from "solid-js"

const doubled = createMemo(() => count() * 2)
```

**OpenCode 实例** - 来自 `pages/home.tsx`：

```typescript
const recent = createMemo(() => {
  return sync.data.project
    .toSorted((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
    .slice(0, 5)
})
```

### 3. 副作用（Effect）

使用 `createEffect` 处理副作用：

```typescript
import { createEffect } from "solid-js"

createEffect(() => {
  console.log("Count changed:", count())
  document.title = `Count: ${count()}`
})
```

**OpenCode 实例** - 来自 `context/settings.tsx`：

```typescript
createEffect(() => {
  if (typeof document === "undefined") return
  document.documentElement.style.setProperty("--font-family-mono", monoFontFamily(store.appearance?.font))
})
```

---

## 组件基础

### 函数组件

SolidJS 组件是接收 props 的函数：

```typescript
import { Component, ParentProps } from "solid-js"

interface ButtonProps {
  variant?: "primary" | "secondary"
  onClick: () => void
}

const Button: Component<ButtonProps> = (props) => {
  return (
    <button
      class={`btn btn-${props.variant}`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

// 使用 ParentProps 处理 children
const Card: ParentProps<{ title: string }> = (props) => {
  return (
    <div class="card">
      <h2>{props.title}</h2>
      {props.children}
    </div>
  )
}
```

**OpenCode 实例** - 来自 `components/terminal.tsx`：

```typescript
export interface TerminalProps extends ComponentProps<"div"> {
  pty: LocalPTY
  onSubmit?: () => void
  onCleanup?: (pty: LocalPTY) => void
  onConnect?: () => void
  onConnectError?: (error: unknown) => void
}

export const Terminal = (props: TerminalProps) => {
  const [local, others] = splitProps(props, ["pty", "class", "classList", "onConnect", "onConnectError"])

  return (
    <div
      ref={container}
      {...others}
    />
  )
}
```

### 条件渲染

使用 `Show` 组件：

```typescript
import { Show } from "solid-js"

function UserProfile() {
  const [isLoggedIn, setIsLoggedIn] = createSignal(false)

  return (
    <Show when={isLoggedIn()} fallback={<LoginButton />}>
      <Dashboard />
    </Show>
  )
}
```

**OpenCode 实例** - 来自 `pages/home.tsx`：

```typescript
<Switch>
  <Match when={sync.data.project.length > 0}>
    <div>Recent Projects</div>
  </Match>
  <Match when={true}>
    <div>No projects</div>
  </Match>
</Switch>
```

### 列表渲染

使用 `For` 组件：

```typescript
import { For } from "solid-js"

function TodoList() {
  const [todos, setTodos] = createSignal([
    { id: 1, text: "Learn SolidJS" },
    { id: 2, text: "Build app" }
  ])

  return (
    <ul>
      <For each={todos()}>
        {(todo) => (
          <li>{todo.text}</li>
        )}
      </For>
    </ul>
  )
}
```

**OpenCode 实例** - 来自 `pages/home.tsx`：

```typescript
<For each={recent()}>
  {(project) => (
    <Button onClick={() => openProject(project.worktree)}>
      {project.worktree.replace(homedir(), "~")}
    </Button>
  )}
</For>
```

---

## 状态管理

### Store vs Signal

在 OpenCode 项目中，我们遵循一个重要原则：

> **始终优先使用 `createStore` 而非多个 `createSignal` 调用**

来自 `packages/app/AGENTS.md`：

```
SolidJS
- Always prefer `createStore` over multiple `createSignal` calls
```

#### 为什么使用 createStore？

- **结构化数据**：更适合管理复杂状态
- **细粒度更新**：只更新变化的部分
- **性能更好**：减少信号追踪开销
- **更清晰**：相关状态组织在一起

#### 基本用法

```typescript
import { createStore } from "solid-js/store"

function App() {
  const [state, setState] = createStore({
    user: {
      name: "John",
      age: 30,
    },
    items: [],
  })

  // 更新嵌套属性
  const updateAge = () => {
    setState("user", "age", state.user.age + 1)
  }

  // 更新数组
  const addItem = (item: string) => {
    setState("items", (items) => [...items, item])
  }

  return <div>{state.user.name}</div>
}
```

**OpenCode 实例** - 来自 `context/settings.tsx`：

```typescript
const defaultSettings: Settings = {
  general: {
    autoSave: true,
    releaseNotes: true,
  },
  appearance: {
    fontSize: 14,
    font: "ibm-plex-mono",
  },
  // ...
}

const [store, setStore, _, ready] = persisted("settings.v3", createStore<Settings>(defaultSettings))
```

#### 使用 produce 进行不可变更新

```typescript
import { createStore, produce } from "solid-js/store"

const [store, setStore] = createStore({
  todos: [
    { id: 1, text: "Task 1", completed: false },
    { id: 2, text: "Task 2", completed: false },
  ],
})

// 使用 produce 简化复杂更新
setStore(
  "todos",
  produce((todos) => {
    const task = todos.find((t) => t.id === 1)
    if (task) task.completed = true
    todos.push({ id: 3, text: "New task", completed: false })
  }),
)
```

**OpenCode 实例** - 来自 `context/prompt.tsx`：

```typescript
setPrompt(
  produce((prompt) => {
    const item = prompt.items.find((i) => i.id === id)
    if (item) item.content = value
  }),
)
```

#### 使用 reconcile 替换整个对象

```typescript
import { createStore, reconcile } from "solid-js/store"

const [store, setStore] = createStore({
  items: [{ id: 1 }, { id: 2 }],
})

// 智能替换，保持引用不变
setStore("items", reconcile(newItems))
```

**OpenCode 实例** - 来自 `components/status-popover.tsx`：

```typescript
setStore("status", reconcile(results))
```

---

## 生命周期

### onMount

组件挂载后执行：

```typescript
import { onMount } from "solid-js"

function Component() {
  onMount(() => {
    console.log("Component mounted")
    // API 调用、事件监听器设置等
  })

  return <div>Hello</div>
}
```

**OpenCode 实例** - 来自 `components/status-popover.tsx`：

```typescript
onMount(() => {
  const check = () => {
    const nameTruncated = nameRef ? nameRef.scrollWidth > nameRef.clientWidth : false
    const versionTruncated = versionRef ? versionRef.scrollWidth > versionRef.clientWidth : false
    setTruncated(nameTruncated || versionTruncated)
  }
  check()
  window.addEventListener("resize", check)
  onCleanup(() => window.removeEventListener("resize", check))
})
```

### onCleanup

清理副作用：

```typescript
import { onCleanup, createEffect } from "solid-js"

function Component() {
  createEffect(() => {
    const interval = setInterval(() => {
      console.log("Tick")
    }, 1000)

    onCleanup(() => {
      clearInterval(interval)
    })
  })

  return <div>...</div>
}
```

**OpenCode 实例** - 来自 `components/terminal.tsx`：

```typescript
onCleanup(() => {
  disposed = true
  const t = term
  if (serializeAddon && props.onCleanup && t) {
    const buffer = (() => {
      try {
        return serializeAddon.serialize()
      } catch {
        return ""
      }
    })()
    props.onCleanup({
      ...local.pty,
      buffer,
      rows: t.rows,
      cols: t.cols,
      scrollY: t.getViewportY(),
    })
  }

  cleanup()
})
```

### createRoot

创建独立的响应式上下文：

```typescript
import { createRoot, createSignal } from "solid-js"

// 在组件外部创建响应式状态
const dispose = createRoot((dispose) => {
  const [count, setCount] = createSignal(0)
  // 这个状态会一直存在，直到调用 dispose()
  return dispose
})

// 清理
dispose()
```

**OpenCode 实例** - 来自 `context/prompt.tsx`：

```typescript
createRoot((dispose) => {
  const [prompt, setPrompt] = createStore<Prompt>(getInitialPrompt())

  return {
    dispose,
    get current() {
      return prompt
    },
    setPrompt,
    // ...
  }
})
```

---

## 实战示例

### 示例 1：计数器

```typescript
import { createSignal, createMemo } from "solid-js"

function Counter() {
  const [count, setCount] = createSignal(0)

  const doubled = createMemo(() => count() * 2)

  return (
    <div>
      <p>Count: {count()}</p>
      <p>Doubled: {doubled()}</p>
      <button onClick={() => setCount(count() + 1)}>+</button>
      <button onClick={() => setCount(count() - 1)}>-</button>
    </div>
  )
}
```

### 示例 2：Todo 应用

```typescript
import { createStore, produce } from "solid-js/store"
import { For, Show } from "solid-js"

interface Todo {
  id: number
  text: string
  completed: boolean
}

function TodoApp() {
  const [state, setState] = createStore({
    todos: [] as Todo[],
    input: "",
  })

  const addTodo = () => {
    if (!state.input.trim()) return

    setState(
      "todos",
      produce((todos) => {
        todos.push({
          id: Date.now(),
          text: state.input,
          completed: false,
        })
      })
    )
    setState("input", "")
  }

  const toggleTodo = (id: number) => {
    setState(
      "todos",
      produce((todos) => {
        const todo = todos.find((t) => t.id === id)
        if (todo) todo.completed = !todo.completed
      })
    )
  }

  const deleteTodo = (id: number) => {
    setState("todos", (todos) => todos.filter((t) => t.id !== id))
  }

  return (
    <div>
      <input
        type="text"
        value={state.input}
        onInput={(e) => setState("input", e.currentTarget.value)}
        onKeyPress={(e) => e.key === "Enter" && addTodo()}
      />
      <button onClick={addTodo}>Add</button>

      <ul>
        <For each={state.todos}>
          {(todo) => (
            <li>
              <Show
                when={todo.completed}
                fallback={<s>{todo.text}</s>}
              >
                {todo.text}
              </Show>
              <button onClick={() => toggleTodo(todo.id)}>
                Toggle
              </button>
              <button onClick={() => deleteTodo(todo.id)}>
                Delete
              </button>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}
```

### 示例 3：异步数据加载

```typescript
import { createResource, Show, For } from "solid-js"

async function fetchUsers() {
  const res = await fetch("https://api.example.com/users")
  return res.json()
}

function UserList() {
  const [users] = createResource(fetchUsers)

  return (
    <Show
      when={users()}
      fallback={<p>Loading...</p>}
    >
      {(users) => (
        <ul>
          <For each={users()}>
            {(user) => <li>{user.name}</li>}
          </For>
        </ul>
      )}
    </Show>
  )
}
```

### 示例 4：自定义 Hook

```typescript
import { createSignal, onCleanup } from "solid-js"

function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = createSignal<T>(() => {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : initialValue
  })

  const setStoredValue = (newValue: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof newValue === "function" ? (newValue as (prev: T) => T)(prev) : newValue
      localStorage.setItem(key, JSON.stringify(next))
      return next
    })
  }

  return [value, setStoredValue] as const
}

// 使用
function App() {
  const [count, setCount] = useLocalStorage("count", 0)

  return (
    <div>
      <p>Count: {count()}</p>
      <button onClick={() => setCount(count() + 1)}>+</button>
    </div>
  )
}
```

---

## 最佳实践

### 1. 状态组织

**推荐**：使用 `createStore` 组织相关状态

```typescript
// ✅ 推荐
const [state, setState] = createStore({
  user: {
    name: "",
    email: "",
    age: 0,
  },
  preferences: {
    theme: "dark",
    language: "en",
  },
})

// ❌ 避免
const [userName, setUserName] = createSignal("")
const [userEmail, setUserEmail] = createSignal("")
const [userAge, setUserAge] = createSignal(0)
const [theme, setTheme] = createSignal("dark")
const [language, setLanguage] = createSignal("en")
```

### 2. 派生状态

**推荐**：使用 `createMemo` 计算派生值

```typescript
const [items, setItems] = createStore({
  list: [],
  filter: "",
})

// ✅ 推荐
const filteredItems = createMemo(() => {
  return items.list.filter((item) => item.name.toLowerCase().includes(items.filter.toLowerCase()))
})

// ❌ 避免
const filteredItems = () => {
  return items.list.filter((item) => item.name.toLowerCase().includes(items.filter.toLowerCase()))
}
```

### 3. 条件渲染

**推荐**：使用 `Show` 而非三元运算符

```typescript
// ✅ 推荐
<Show when={isLoggedIn()}>
  <Dashboard />
</Show>

<Show when={isLoggedIn()} fallback={<Login />}>
  <Dashboard />
</Show>

// ❌ 避免
{isLoggedIn() ? <Dashboard /> : <Login />}
```

### 4. 事件处理

**推荐**：使用箭头函数或 `on*` 回调

```typescript
// ✅ 推荐
<button onClick={() => setCount(count() + 1)}>Increment</button>
<input onInput={(e) => setValue(e.currentTarget.value)} />

// ❌ 避免
<button onClick={setCount(count() + 1)}>Increment</button>
```

### 5. 组件拆分

**推荐**：保持组件专注和可复用

```typescript
// ✅ 推荐
const UserCard: Component<{ user: User }> = (props) => {
  return (
    <div class="user-card">
      <h3>{props.user.name}</h3>
      <p>{props.user.email}</p>
    </div>
  )
}

function UserList() {
  const [users, setUsers] = createStore({ list: [] })

  return (
    <div>
      <For each={users.list}>
        {(user) => <UserCard user={user} />}
      </For>
    </div>
  )
}
```

### 6. Props 处理

**推荐**：使用 `splitProps` 分离 props

```typescript
// ✅ 推荐
const Button: Component<ButtonProps> = (props) => {
  const [local, others] = splitProps(props, ["variant", "size", "disabled"])

  return (
    <button
      class={`btn ${local.variant} ${local.size}`}
      disabled={local.disabled}
      {...others}
    >
      {props.children}
    </button>
  )
}

// ❌ 避免
const Button: Component<ButtonProps> = (props) => {
  return (
    <button
      class={`btn ${props.variant} ${props.size}`}
      disabled={props.disabled}
      onClick={props.onClick}
      type={props.type}
      // ... 手动传递所有原生属性
    >
      {props.children}
    </button>
  )
}
```

### 7. Context 使用

**推荐**：使用 Context 共享全局状态

```typescript
// 创建 Context
import { createContext, useContext } from "solid-js"

const ThemeContext = createContext<{
  theme: Accessor<string>
  setTheme: (theme: string) => void
}>()

// 提供 Context
export function ThemeProvider(props: ParentProps) {
  const [theme, setTheme] = createSignal("light")

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {props.children}
    </ThemeContext.Provider>
  )
}

// 使用 Context
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}
```

**OpenCode 实例** - 来自 `context/platform.tsx`：

```typescript
export const { use: usePlatform, provider: PlatformProvider } = createSimpleContext({
  name: "Platform",
  init: (props: { value: Platform }) => {
    return props.value
  },
})
```

### 8. 性能优化

**推荐**：避免不必要的重新渲染

```typescript
// ✅ 推荐：使用 Memo 缓存计算结果
const expensiveValue = createMemo(() => {
  return heavyComputation(state.input)
})

// ✅ 推荐：使用 Show 延迟加载
<Show when={shouldRender()}>
  <ExpensiveComponent />
</Show>

// ✅ 推荐：使用 lazy 懒加载组件
const ExpensiveComponent = lazy(() => import("./ExpensiveComponent"))

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <ExpensiveComponent />
    </Suspense>
  )
}
```

**OpenCode 实例** - 来自 `app.tsx`：

```typescript
const Home = lazy(() => import("@/pages/home"))
const Session = lazy(() => import("@/pages/session"))

<Route
  path="/"
  component={() => (
    <Suspense fallback={<Loading />}>
      <Home />
    </Suspense>
  )}
/>
```

---

## 常用生态系统

### 路由

```typescript
import { Router, Route, useNavigate, useParams, A } from "@solidjs/router"

function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/users/:id" component={UserDetail} />
      <Route path="/404" component={NotFound} />
    </Router>
  )
}

function UserDetail() {
  const params = useParams()
  const navigate = useNavigate()

  return (
    <div>
      <h1>User {params.id}</h1>
      <A href="/">Back home</A>
    </div>
  )
}
```

**OpenCode 实例** - 来自 `app.tsx`：

```typescript
import { Router, Route, Navigate } from "@solidjs/router"
import { useNavigate, useParams } from "@solidjs/router"

<Router>
  <Route path="/" component={() => (
    <Suspense fallback={<Loading />}>
      <Home />
    </Suspense>
  )} />
  <Route path="/:dir" component={DirectoryLayout}>
    <Route path="/" component={() => <Navigate href="session" />} />
    <Route path="/session/:id?" component={Session} />
  </Route>
</Router>
```

### Meta 标签管理

```typescript
import { MetaProvider, Title } from "@solidjs/meta"

function App() {
  return (
    <MetaProvider>
      <Title>My App</Title>
      <MainContent />
    </MetaProvider>
  )
}
```

**OpenCode 实例** - 来自 `app.tsx`：

```typescript
import { MetaProvider } from "@solidjs/meta"

export function AppBaseProviders(props: ParentProps) {
  return (
    <MetaProvider>
      <ThemeProvider>
        {/* ... */}
      </ThemeProvider>
    </MetaProvider>
  )
}
```

### Solid Primitives

#### 1. Storage

```typescript
import { createStorage } from "@solid-primitives/storage"

const [value, setValue] = createStorage("my-key", "default value")
```

#### 2. Media Query

```typescript
import { createMediaQuery } from "@solid-primitives/media"

const isMobile = createMediaQuery("(max-width: 768px)")

return (
  <Show when={isMobile()}>
    <MobileLayout />
  </Show>
)
```

**OpenCode 实例** - 来自 `pages/session.tsx`：

```typescript
import { createMediaQuery } from "@solid-primitives/media"
import { createResizeObserver } from "@solid-primitives/resize-observer"

const isMobile = createMediaQuery("(max-width: 768px)")
```

#### 3. Resize Observer

```typescript
import { createResizeObserver } from "@solid-primitives/resize-observer"

const [size] = createResizeObserver(ref)

return <div>Width: {size().width}px</div>
```

#### 4. Event Bus

```typescript
import { createGlobalEmitter } from "@solid-primitives/event-bus"

const emitter = createGlobalEmitter<{
  message: string
}>()

// 发送事件
emitter.emit("message", "Hello")

// 监听事件
emitter.on("message", (msg) => {
  console.log(msg)
})
```

**OpenCode 实例** - 来自 `context/global-sdk.tsx`：

```typescript
import { createGlobalEmitter } from "@solid-primitives/event-bus"

export function GlobalSDKProvider(props: ParentProps) {
  const emitter = createGlobalEmitter<{
    message: string
  }>()

  // ...
}
```

#### 5. Active Element

```typescript
import { createFocusSignal } from "@solid-primitives/active-element"

const focused = createFocusSignal()

return <Show when={focused() === element}>Focused</Show>
```

**OpenCode 实例** - 来自 `components/prompt-input.tsx`：

```typescript
import { createFocusSignal } from "@solid-primitives/active-element"

const focused = createFocusSignal()
```

### 拖拽功能

```typescript
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  SortableProvider,
  closestCenter
} from "@thisbeyond/solid-dnd"

function SortableList() {
  const [items, setItems] = createSignal([1, 2, 3])

  return (
    <DragDropProvider
      onDragEnd={handleDragEnd}
      collisionDetector={closestCenter}
    >
      <DragDropSensors />
      <SortableProvider ids={items()}>
        <For each={items()}>
          {(id) => <SortableItem id={id} />}
        </For>
      </SortableProvider>
      <DragOverlay>
        <Show when={activeId()}>
          {(id) => <SortableItem id={id()} />}
        </Show>
      </DragOverlay>
    </DragDropProvider>
  )
}
```

**OpenCode 实例** - 来自 `pages/session.tsx`：

```typescript
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  SortableProvider,
  closestCenter
} from "@thisbeyond/solid-dnd"

<DragDropProvider onDragEnd={handleDragEnd} collisionDetector={closestCenter}>
  <DragDropSensors />
  <SortableProvider ids={tabs()}>
    <For each={tabs()}>
      {(tab) => <SortableTab tab={tab} />}
    </For>
  </SortableProvider>
</DragDropProvider>
```

---

## 高级主题

### 1. 批量更新

使用 `batch` 避免多次响应式更新：

```typescript
import { batch } from "solid-js"

function updateMultiple() {
  batch(() => {
    setName("John")
    setAge(30)
    setEmail("john@example.com")
  })
}
```

**OpenCode 实例** - 来自 `context/sdk.tsx`：

```typescript
import { batch } from "solid-js"

batch(() => {
  // 多个状态更新只触发一次重新渲染
  setServerUrl(url)
  setDirectory(directory)
})
```

### 2. 错误边界

```typescript
import { ErrorBoundary } from "solid-js"

function App() {
  return (
    <ErrorBoundary fallback={(error) => <ErrorFallback error={error} />}>
      <MainContent />
    </ErrorBoundary>
  )
}
```

**OpenCode 实例** - 来自 `app.tsx`：

```typescript
<ErrorBoundary fallback={(error) => <ErrorPage error={error} />}>
  <DialogProvider>
    {/* ... */}
  </DialogProvider>
</ErrorBoundary>
```

### 3. Suspense 和数据加载

```typescript
import { Suspense, createResource } from "solid-js"

function App() {
  const [data] = createResource(fetchData)

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Show when={data()}>
        {(loaded) => <DataDisplay data={loaded()} />}
      </Show>
    </Suspense>
  )
}
```

### 4. Portal

```typescript
import { Portal } from "solid-js/web"

function Modal() {
  return (
    <Portal mount={document.body}>
      <div class="modal-overlay">
        <div class="modal-content">
          Modal Content
        </div>
      </div>
    </Portal>
  )
}
```

**OpenCode 实例** - 来自 `components/session/session-header.tsx`：

```typescript
import { Portal } from "solid-js/web"

<Portal>
  <div class="header-content">
    {/* ... */}
  </div>
</Portal>
```

### 5. Dynamic 组件

```typescript
import { Dynamic } from "solid-js/web"

function DynamicComponentLoader() {
  const [component, setComponent] = createSignal(ComponentA)

  return (
    <div>
      <button onClick={() => setComponent(ComponentA)}>A</button>
      <button onClick={() => setComponent(ComponentB)}>B</button>
      <Dynamic component={component()} />
    </div>
  )
}
```

**OpenCode 实例** - 来自 `pages/session.tsx`：

```typescript
import { Dynamic } from "solid-js/web"

<Dynamic component={currentView()} />
```

---

## 总结

SolidJS 是一个强大且高效的 UI 库，特别适合构建复杂的应用程序。通过学习本指南并结合 OpenCode 项目的实际代码，你应该能够：

1. ✅ 理解 SolidJS 的核心概念和响应式系统
2. ✅ 掌握组件、状态管理和生命周期
3. ✅ 了解最佳实践和性能优化技巧
4. ✅ 熟悉常用的生态系统和第三方库
5. ✅ 能够构建实际的应用程序

### 关键要点回顾

- **优先使用 `createStore`** 而非多个 `createSignal` 调用
- **使用 `createMemo`** 创建派生状态，避免重复计算
- **使用 `Show`** 进行条件渲染，避免三元运算符
- **使用 `splitProps`** 分离和处理组件 props
- **使用 `onCleanup`** 清理副作用，防止内存泄漏
- **利用 Context** 共享全局状态
- **使用 Suspense 和 lazy** 优化加载性能
- **批量更新** 避免不必要的重新渲染

### 学习资源

- [SolidJS 官方文档](https://www.solidjs.com/docs)
- [SolidJS GitHub](https://github.com/solidjs/solid)
- [SolidPrimitives](https://primitives.solidjs.community)
- [Awesome SolidJS](https://github.com/solidjs-community/awesome-solid)

---

**Happy Coding with SolidJS! 🚀**
