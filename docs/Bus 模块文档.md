# Bus 模块文档

Bus 模块位于 `src/bus` 目录下，提供了一个类型安全的事件发布/订阅系统，用于 opencode 内部各模块之间的通信。

## 模块结构

```
src/bus/
├── index.ts       # 主模块，提供 Bus namespace
├── bus-event.ts   # 事件定义工具
└── global.ts      # 全局事件总线
```

## 核心概念

### 1. BusEvent - 事件定义

`BusEvent` 命名空间用于定义类型安全的事件。每个事件包含：
- `type`: 事件类型标识符（字符串）
- `properties`: 使用 Zod schema 定义的事件属性

```typescript
import { BusEvent } from "@/bus/bus-event"
import z from "zod"

// 定义一个事件
export const MyEvent = BusEvent.define(
  "my.event.type",
  z.object({
    id: z.string(),
    data: z.any(),
  })
)
```

`BusEvent.payloads()` 方法返回所有已注册事件的联合类型 schema，用于 API 文档生成和类型验证。

### 2. GlobalBus - 全局事件总线

`GlobalBus` 是一个全局的 `EventEmitter` 实例，用于跨实例的事件广播。它在以下场景中使用：

- 向 SSE 客户端推送事件
- 跨 worktree 实例的事件通信
- 全局状态变更通知

```typescript
import { GlobalBus } from "@/bus/global"

// 发送事件
GlobalBus.emit("event", {
  directory: "/path/to/project",
  payload: {
    type: "my.event.type",
    properties: { ... }
  }
})

// 监听事件
GlobalBus.on("event", (event) => {
  console.log(event.directory, event.payload)
})
```

### 3. Bus - 主模块

`Bus` 命名空间提供完整的发布/订阅功能，是大多数模块使用的主要接口。

#### 发布事件

```typescript
import { Bus } from "@/bus"

// 发布事件（会同时通知本地订阅者和 GlobalBus）
await Bus.publish(Session.Event.Created, {
  info: sessionInfo
})
```

#### 订阅事件

```typescript
import { Bus } from "@/bus"

// 订阅特定事件
const unsubscribe = Bus.subscribe(Session.Event.Updated, (event) => {
  console.log("Session updated:", event.properties.info)
})

// 订阅一次（满足条件后自动取消）
Bus.once(Session.Event.Created, (event) => {
  if (event.properties.info.id === targetId) {
    return "done" // 返回 "done" 取消订阅
  }
})

// 订阅所有事件
const unsubscribeAll = Bus.subscribeAll((event) => {
  console.log("Event:", event.type, event.properties)
})

// 取消订阅
unsubscribe()
```

## 使用模式

### 模式一：在命名空间中定义事件

大多数模块采用这种模式，在模块的 `Event` 属性下定义相关事件：

```typescript
// src/session/index.ts
import { BusEvent } from "@/bus/bus-event"

export namespace Session {
  export const Event = {
    Created: BusEvent.define(
      "session.created",
      z.object({ info: Info })
    ),
    Updated: BusEvent.define(
      "session.updated",
      z.object({ info: Info })
    ),
    Deleted: BusEvent.define(
      "session.deleted",
      z.object({ info: Info })
    ),
  }
}
```

### 模式二：发布状态变更

当模块状态发生变化时发布事件：

```typescript
// 创建 session 后发布事件
const session = await createSession(options)
await Bus.publish(Session.Event.Created, { info: session })
```

### 模式三：文件监听事件

文件系统变更通过 Bus 广播：

```typescript
// src/file/watcher.ts
export namespace FileWatcher {
  export const Event = {
    Updated: BusEvent.define(
      "file.watcher.updated",
      z.object({
        file: z.string(),
        event: z.union([
          z.literal("add"),
          z.literal("change"),
          z.literal("unlink")
        ]),
      }),
    ),
  }
}

// 当文件变化时发布
Bus.publish(Event.Updated, { file: filePath, event: "change" })
```

## 事件类型列表

以下是系统中定义的主要事件类型：

| 模块 | 事件类型 | 说明 |
|------|----------|------|
| Session | `session.created` | Session 创建 |
| Session | `session.updated` | Session 更新 |
| Session | `session.deleted` | Session 删除 |
| Session | `session.error` | Session 错误 |
| Session | `session.status` | Session 状态变更 |
| Message | `message.updated` | 消息更新 |
| Message | `message.removed` | 消息删除 |
| Message | `message.part.updated` | 消息部分更新（流式） |
| File | `file.edited` | 文件被编辑 |
| FileWatcher | `file.watcher.updated` | 文件系统变更 |
| Permission | `permission.asked` | 请求权限 |
| Permission | `permission.replied` | 权限回复 |
| Project | `project.updated` | 项目信息更新 |
| Vcs | `vcs.branch.updated` | Git 分支变更 |
| LSP | `lsp.updated` | LSP 状态更新 |
| LSP | `lsp.client.diagnostics` | LSP 诊断信息 |
| PTY | `pty.created` / `pty.updated` / `pty.exited` / `pty.deleted` | 终端生命周期 |
| MCP | `mcp.tools.changed` | MCP 工具变更 |
| IDE | `ide.installed` | IDE 安装完成 |
| Installation | `installation.updated` | 安装更新 |
| Worktree | `worktree.ready` / `worktree.failed` | Worktree 状态 |
| Command | `command.executed` | 命令执行 |
| Todo | `todo.updated` | Todo 列表更新 |
| Question | `question.asked` / `question.replied` / `question.rejected` | 问答交互 |
| Server | `server.connected` / `global.disposed` | 服务器状态 |
| TUI | `tui.prompt.append` / `tui.toast.show` 等 | TUI 交互事件 |

## 实例生命周期

`Bus` 模块与 `Instance` 模块集成，当实例被销毁时会自动：

1. 发布 `server.instance.disposed` 事件
2. 通知所有通配符订阅者（`*`）
3. 清理该实例的订阅

```typescript
// 内置的实例销毁事件
export const InstanceDisposed = BusEvent.define(
  "server.instance.disposed",
  z.object({
    directory: z.string(),
  }),
)
```

## SSE 事件流

服务器通过 `GlobalBus` 将事件推送给 SSE 客户端：

```typescript
// src/server/routes/global.ts
GlobalBus.on("event", async (event) => {
  await stream.writeSSE({
    data: JSON.stringify(event),
  })
})
```

客户端可以通过 `/event` 端点订阅全局事件流。

## 最佳实践

1. **事件命名规范**: 使用 `模块.动作` 格式，如 `session.created`、`file.edited`
2. **使用 Zod 定义属性**: 确保类型安全和运行时验证
3. **及时取消订阅**: 保存 `unsubscribe` 函数并在适当时机调用
4. **避免循环触发**: 订阅者内发布事件时注意避免无限循环
5. **使用 GlobalBus 进行跨实例通信**: 普通 `Bus.publish` 仅在当前实例内广播，同时也会发送到 GlobalBus
