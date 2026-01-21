# TUI 命令详解

## 目录

1. [TUI 命令概览](#tui-命令概览)
2. [CLI TUI 命令](#cli-tui-命令)
3. [TUI 内部命令系统](#tui-内部命令系统)
4. [键盘绑定系统](#键盘绑定系统)
5. [输入编辑绑定](#输入编辑绑定)
6. [TUI 组件命令](#tui-组件命令)
7. [服务器交互](#服务器交互)
8. [命令配置](#命令配置)
9. [扩展与定制](#扩展与定制)

---

## TUI 命令概览

OpenCode 的 TUI（Terminal User Interface）提供了丰富的命令系统，分为三个层次：

1. **CLI 级别命令** - 从命令行启动 TUI 的命令
2. **TUI 内部命令** - 在 TUI 中执行的命令，通过命令面板或快捷键触发
3. **键盘绑定** - 直接通过键盘快捷键触发的操作

TUI 命令系统基于以下技术栈：

- **OpenTUI** - 终端 UI 框架
- **SolidJS** - 响应式 UI 编程
- **自定义键盘绑定系统** - 可配置的快捷键

---

## CLI TUI 命令

### 1. `opencode [project]` - 启动 TUI

启动 OpenCode 的终端用户界面，这是使用 OpenCode 的主要方式。

#### 语法

```bash
opencode [project] [options]
```

#### 参数

| 参数      | 类型   | 描述                             |
| --------- | ------ | -------------------------------- |
| `project` | string | （可选）项目路径，默认为当前目录 |

#### 选项

| 选项         | 别名 | 类型    | 描述                                |
| ------------ | ---- | ------- | ----------------------------------- |
| `--model`    | `-m` | string  | 使用的模型，格式为 `provider/model` |
| `--continue` | `-c` | boolean | 继续上一次会话                      |
| `--session`  | `-s` | string  | 指定要继续的会话 ID                 |
| `--prompt`   |      | string  | 初始提示词                          |
| `--agent`    |      | string  | 指定使用的代理                      |
| `--port`     |      | number  | 服务器端口（用于外部访问）          |
| `--hostname` |      | string  | 服务器主机名                        |
| `--mdns`     |      | boolean | 启用 mDNS 广播                      |

#### 网络选项

这些选项用于控制 TUI 与服务器的通信模式：

```bash
# 本地模式（默认）
opencode

# 启动 HTTP 服务器（允许外部访问）
opencode --port 4096

# 使用 mDNS 广播
opencode --mdns

# 指定主机名
opencode --hostname 0.0.0.0 --port 4096
```

#### 使用示例

```bash
# 在当前目录启动 TUI
opencode

# 在指定项目目录启动
opencode /path/to/project

# 使用特定模型启动
opencode --model anthropic/claude-sonnet-4-20250514

# 继续上一次会话
opencode --continue

# 继续特定会话
opencode --session ses_abc123

# 启动时提供初始提示词
opencode --prompt "帮我重构这个函数"

# 启动 HTTP 服务器供外部访问
opencode --port 4096

# 启动并选择特定代理
opencode --agent plan
```

#### 工作模式

TUI 有两种通信模式：

**本地模式（默认）**：

- 无 HTTP 服务器
- 直接通过 Web Worker RPC 与服务器通信
- 更快、更安全
- 仅限本地使用

**服务器模式**：

- 启动 HTTP 服务器
- 允许外部客户端连接
- 支持 Web UI、移动应用连接
- 可通过 `--port`、`--hostname`、`--mdns` 控制

#### 内部实现

位置：`packages/opencode/src/cli/cmd/tui/thread.ts`

```typescript
export const TuiThreadCommand = cmd({
  command: "$0 [project]",
  describe: "start opencode tui",
  builder: (yargs) =>
    withNetworkOptions(yargs)
      .positional("project", { ... })
      .option("model", { ... })
      .option("continue", { ... })
      // ...
  handler: async (args) => {
    // 1. 解析工作目录
    const cwd = args.project ? path.resolve(baseCwd, args.project) : process.cwd()

    // 2. 创建 Web Worker
    const worker = new Worker(workerPath, { env: ... })

    // 3. 初始化 RPC 客户端
    const client = Rpc.client<typeof rpc>(worker)

    // 4. 决定是否启动 HTTP 服务器
    if (shouldStartServer) {
      const server = await client.call("server", networkOpts)
      url = server.url
    } else {
      url = "http://opencode.internal"
      customFetch = createWorkerFetch(client)
      events = createEventSource(client)
    }

    // 5. 启动 TUI
    await tui({ url, fetch: customFetch, events, args, onExit: ... })
  },
})
```

---

### 2. `opencode attach <url>` - 连接到远程服务器

连接到正在运行的 OpenCode 服务器，并启动 TUI 客户端。

#### 语法

```bash
opencode attach <url> [options]
```

#### 参数

| 参数  | 类型   | 描述                                             |
| ----- | ------ | ------------------------------------------------ |
| `url` | string | （必需）服务器 URL，例如 `http://localhost:4096` |

#### 选项

| 选项        | 类型   | 描述             |
| ----------- | ------ | ---------------- | ------------------- |
| `--dir`     | string | 在指定目录中运行 |
| `--session` | `-s`   | string           | 指定要继续的会话 ID |

#### 使用示例

```bash
# 连接到本地服务器
opencode attach http://localhost:4096

# 连接到远程服务器
opencode attach http://192.168.1.100:4096

# 在指定目录中连接
opencode attach http://localhost:4096 --dir /path/to/project

# 继续特定会话
opencode attach http://localhost:4096 --session ses_abc123
```

#### 内部实现

位置：`packages/opencode/src/cli/cmd/tui/attach.ts`

```typescript
export const AttachCommand = cmd({
  command: "attach <url>",
  describe: "attach to a running opencode server",
  builder: (yargs) =>
    yargs
      .positional("url", { type: "string", demandOption: true })
      .option("dir", { ... })
      .option("session", { ... }),
  handler: async (args) => {
    if (args.dir) process.chdir(args.dir)
    await tui({
      url: args.url,
      args: { sessionID: args.session },
      directory: args.dir ? process.cwd() : undefined,
    })
  },
})
```

#### 工作原理

`attach` 命令与 `opencode [project]` 的区别：

| 特性       | `opencode [project]`   | `opencode attach` |
| ---------- | ---------------------- | ----------------- |
| 服务器启动 | 自动启动本地 Worker    | 连接到现有服务器  |
| 使用场景   | 本地开发               | 远程开发/协作     |
| 工作目录   | 自动切换到项目目录     | 可选指定目录      |
| 灵活性     | 高（可随时启动服务器） | 依赖服务器运行中  |

---

## TUI 内部命令系统

TUI 内部命令是通过**命令面板**（Command Palette）或**键盘快捷键**触发的命令。

### 命令面板

按 `Ctrl+P`（默认）或输入 `/` 打开命令面板。命令面板提供：

- 搜索过滤命令
- 显示快捷键
- 分类显示命令
- 斜杠命令（`/command`）

### 命令分类

TUI 命令按功能分为以下类别：

#### 1. Session（会话）命令

| 命令                          | 描述               | 快捷键   | 斜杠命令                                |
| ----------------------------- | ------------------ | -------- | --------------------------------------- |
| `session.list`                | 切换会话           | `Ctrl+L` | `/sessions`<br>`/resume`<br>`/continue` |
| `session.new`                 | 新建会话           | `Ctrl+N` | `/new`<br>`/clear`                      |
| `session.share`               | 分享会话           | `Ctrl+S` | -                                       |
| `session.interrupt`           | 中断当前操作       | `Ctrl+C` | -                                       |
| `session.compact`             | 压缩会话历史       | `Ctrl+K` | -                                       |
| `session.rename`              | 重命名会话         | `Ctrl+R` | -                                       |
| `session.timeline`            | 查看时间线         | `Ctrl+T` | -                                       |
| `session.fork`                | 分支会话           | `Ctrl+F` | -                                       |
| `session.unshare`             | 取消分享           | `Ctrl+U` | -                                       |
| `session.export`              | 导出会话           | `Ctrl+E` | -                                       |
| `session_child_cycle`         | 切换到子会话       | `]`      | -                                       |
| `session_child_cycle_reverse` | 切换到上一个子会话 | `[`      | -                                       |
| `session_parent`              | 切换到父会话       | `p`      | -                                       |

#### 2. Agent（代理）命令

| 命令                  | 描述         | 快捷键      | 斜杠命令  |
| --------------------- | ------------ | ----------- | --------- |
| `agent.list`          | 列出可用代理 | `Ctrl+A`    | `/agents` |
| `agent.cycle`         | 循环切换代理 | `Tab`       | -         |
| `agent_cycle_reverse` | 反向切换代理 | `Shift+Tab` | -         |
| `variant.cycle`       | 切换模型变体 | -           | -         |

#### 3. Model（模型）命令

| 命令                           | 描述               | 快捷键   | 斜杠命令  |
| ------------------------------ | ------------------ | -------- | --------- |
| `model.list`                   | 切换模型           | `Ctrl+M` | `/models` |
| `model_cycle_recent`           | 循环最近使用的模型 | `Ctrl+]` | -         |
| `model_cycle_recent_reverse`   | 反向循环模型       | `Ctrl+[` | -         |
| `model_cycle_favorite`         | 循环收藏的模型     | `Ctrl+}` | -         |
| `model_cycle_favorite_reverse` | 反向循环收藏       | `Ctrl+{` | -         |

#### 4. Provider（提供商）命令

| 命令               | 描述       | 斜杠命令   |
| ------------------ | ---------- | ---------- |
| `provider.connect` | 连接提供商 | `/connect` |

#### 5. Prompt（提示）命令

| 命令            | 描述     | 快捷键   |
| --------------- | -------- | -------- |
| `prompt.submit` | 提交提示 | `Enter`  |
| `prompt.clear`  | 清空提示 | `Ctrl+W` |

#### 6. Message（消息）命令

| 命令                      | 描述                 | 快捷键      |
| ------------------------- | -------------------- | ----------- |
| `messages_page_up`        | 向上翻页             | `Page Up`   |
| `messages_page_down`      | 向下翻页             | `Page Down` |
| `messages_half_page_up`   | 向上半页             | `Ctrl+U`    |
| `messages_half_page_down` | 向下半页             | `Ctrl+D`    |
| `messages_line_up`        | 向上滚动一行         | `Up`        |
| `messages_line_down`      | 向下滚动一行         | `Down`      |
| `messages_first`          | 跳到开头             | `Home`      |
| `messages_last`           | 跳到结尾             | `End`       |
| `messages_last_user`      | 跳到最后一条用户消息 | -           |
| `messages_next`           | 下一条消息           | `Ctrl+N`    |
| `messages_previous`       | 上一条消息           | `Ctrl+P`    |
| `messages_undo`           | 撤销                 | `Ctrl+Z`    |
| `messages_redo`           | 重做                 | `Ctrl+Y`    |
| `messages_copy`           | 复制选中内容         | `Ctrl+C`    |
| `messages_toggle_conceal` | 切换隐藏敏感信息     | -           |

#### 7. UI（界面）命令

| 命令               | 描述              | 快捷键   |
| ------------------ | ----------------- | -------- | --- |
| `sidebar_toggle`   | 切换侧边栏        | `Ctrl+\` |
| `scrollbar_toggle` | 切换滚动条        | `Ctrl+   | `   |
| `tool_details`     | 显示/隐藏工具详情 | `Ctrl+O` |

#### 8. System（系统）命令

| 命令                    | 描述              | 快捷键         | 斜杠命令                   |
| ----------------------- | ----------------- | -------------- | -------------------------- |
| `status_view`           | 查看状态          | `Ctrl+V`       | `/status`                  |
| `theme.switch`          | 切换主题          | `Ctrl+Shift+T` | `/themes`                  |
| `theme.switch_mode`     | 切换外观（明/暗） | -              | -                          |
| `help.show`             | 显示帮助          | `?`            | `/help`                    |
| `docs.open`             | 打开文档          | -              | -                          |
| `webui.open`            | 打开 WebUI        | -              | -                          |
| `app.exit`              | 退出应用          | `Ctrl+Q`       | `/exit`<br>`/quit`<br>`/q` |
| `app.debug`             | 切换调试面板      | -              | -                          |
| `app.console`           | 切换控制台        | -              | -                          |
| `app.heap_snapshot`     | 写入堆快照        | -              | -                          |
| `terminal.suspend`      | 暂停终端          | `Ctrl+Z`       | -                          |
| `terminal_title_toggle` | 切换终端标题      | -              | -                          |

#### 9. MCP（模型上下文协议）命令

| 命令       | 描述            | 斜杠命令 |
| ---------- | --------------- | -------- |
| `mcp.list` | 切换 MCP 服务器 | `/mcps`  |

#### 10. Editor（编辑器）命令

| 命令          | 描述       | 快捷键   |
| ------------- | ---------- | -------- |
| `editor_open` | 打开编辑器 | `Ctrl+E` |

---

## 键盘绑定系统

OpenCode TUI 的键盘绑定系统是高度可配置的，支持：

- **Leader Key** - 前缀键机制
- **多绑定** - 同一命令可有多个快捷键
- **上下文感知** - 不同组件的独立绑定
- **禁用绑定** - 可设置绑定为 `none`

### 默认 Leader Key

默认 Leader Key 是 `<space>`（空格键）。按下 Leader Key 后，可以在 2 秒内按下下一个键。

示例：

```
<space> s  # 切换会话 (session_list)
<space> n  # 新建会话 (session_new)
```

### 键盘绑定格式

在配置文件中定义键盘绑定：

```json
{
  "keybinds": {
    "leader": "ctrl+space",
    "command_list": "ctrl+p",
    "session_list": "ctrl+l",
    "session_new": "ctrl+n",
    "input_submit": "enter",
    "input_clear": "ctrl+w",
    "messages_page_up": "pageup",
    "messages_page_down": "pagedown"
  }
}
```

### 键盘绑定语法

| 修饰键                      | 说明                    |
| --------------------------- | ----------------------- |
| `ctrl`                      | Control 键              |
| `alt` 或 `meta` 或 `option` | Alt/Option 键           |
| `shift`                     | Shift 键                |
| `super`                     | Windows/Cmd 键          |
| `leader`                    | Leader Key 前缀         |
| `<leader>`                  | 在绑定中引用 Leader Key |

组合多个修饰键使用 `+` 分隔：

```
ctrl+alt+s     # Ctrl+Alt+S
shift+ctrl+>   # Shift+Ctrl+>
ctrl+leader+s   # 使用 Leader Key 的 Ctrl+S
```

多个绑定使用 `,` 分隔：

```
ctrl+p,command_list  # Ctrl+P 或 command_list（如果定义）
```

禁用绑定：

```json
{
  "keybinds": {
    "messages_toggle_conceal": "none"
  }
}
```

### 内部实现

位置：`packages/opencode/src/cli/cmd/tui/context/keybind.tsx`

```typescript
// 键盘绑定提供者
export const { use: useKeybind, provider: KeybindProvider } = createSimpleContext({
  name: "Keybind",
  init: () => {
    const sync = useSync()
    const keybinds = createMemo(() => {
      return pipe(
        sync.data.config.keybinds ?? {},
        mapValues((value) => Keybind.parse(value)),
      )
    })

    // Leader Key 处理
    let leaderActive = false
    useKeyboard((evt) => {
      if (!leaderActive && keybind.match("leader", evt)) {
        leaderActive = true
        // 2 秒后自动取消 Leader 模式
        setTimeout(() => {
          leaderActive = false
        }, 2000)
        return
      }

      if (leaderActive && evt.name) {
        // 在 Leader 模式下处理按键
        leaderActive = false
      }
    })

    return {
      get all() {
        return keybinds()
      },
      get leader() {
        return store.leader
      },
      match(key, evt) {
        /* 匹配按键 */
      },
      print(key) {
        /* 打印快捷键显示 */
      },
    }
  },
})
```

---

## 输入编辑绑定

TUI 的文本输入框（提示框）支持丰富的编辑快捷键。

### 基础编辑

| 操作 | 默认快捷键   | 配置键          |
| ---- | ------------ | --------------- |
| 提交 | `Enter`      | `input_submit`  |
| 新行 | `Ctrl+Enter` | `input_newline` |
| 粘贴 | `Ctrl+V`     | `input_paste`   |
| 清空 | `Ctrl+W`     | `input_clear`   |

### 光标移动

| 操作       | 默认快捷键 | 配置键                |
| ---------- | ---------- | --------------------- |
| 向左       | `Left`     | `input_move_left`     |
| 向右       | `Right`    | `input_move_right`    |
| 向上       | `Up`       | `input_move_up`       |
| 向下       | `Down`     | `input_move_down`     |
| 词向前     | `Alt+F`    | `input_word_forward`  |
| 词向后     | `Alt+B`    | `input_word_backward` |
| 行首       | `Ctrl+A`   | `input_line_home`     |
| 行尾       | `Ctrl+E`   | `input_line_end`      |
| 缓冲区开头 | `Home`     | `input_buffer_home`   |
| 缓冲区结尾 | `End`      | `input_buffer_end`    |

### 选择操作

| 操作             | 默认快捷键     | 配置键                       |
| ---------------- | -------------- | ---------------------------- |
| 选择向左         | `Shift+Left`   | `input_select_left`          |
| 选择向右         | `Shift+Right`  | `input_select_right`         |
| 选择向上         | `Shift+Up`     | `input_select_up`            |
| 选择向下         | `Shift+Down`   | `input_select_down`          |
| 选择词向前       | `Shift+Alt+F`  | `input_select_word_forward`  |
| 选择词向后       | `Shift+Alt+B`  | `input_select_word_backward` |
| 选择到行首       | `Shift+Ctrl+A` | `input_select_line_home`     |
| 选择到行尾       | `Shift+Ctrl+E` | `input_select_line_end`      |
| 选择到缓冲区开头 | `Shift+Home`   | `input_select_buffer_home`   |
| 选择到缓冲区结尾 | `Shift+End`    | `input_select_buffer_end`    |
| 视觉模式行首     | -              | `input_visual_line_home`     |
| 视觉模式行尾     | -              | `input_visual_line_end`      |

### 删除操作

| 操作           | 默认快捷键  | 配置键                       |
| -------------- | ----------- | ---------------------------- |
| 删除字符（前） | `Backspace` | `input_backspace`            |
| 删除字符（后） | `Delete`    | `input_delete`               |
| 删除整行       | `Ctrl+K`    | `input_delete_line`          |
| 删除到行尾     | `Ctrl+D`    | `input_delete_to_line_end`   |
| 删除到行首     | `Ctrl+U`    | `input_delete_to_line_start` |
| 删除词（前）   | `Ctrl+W`    | `input_delete_word_backward` |
| 删除词（后）   | `Alt+D`     | `input_delete_word_forward`  |

### 撤销/重做

| 操作 | 默认快捷键 | 配置键       |
| ---- | ---------- | ------------ |
| 撤销 | `Ctrl+Z`   | `input_undo` |
| 重做 | `Ctrl+Y`   | `input_redo` |

### 历史记录

| 操作       | 默认快捷键 | 配置键             |
| ---------- | ---------- | ------------------ |
| 上一条命令 | `Ctrl+P`   | `history_previous` |
| 下一条命令 | `Ctrl+N`   | `history_next`     |

### 内部实现

位置：`packages/opencode/src/cli/cmd/tui/component/textarea-keybindings.ts`

```typescript
const TEXTAREA_ACTIONS = [
  "submit",
  "newline",
  "move-left",
  "move-right",
  "move-up",
  "move-down",
  "select-left",
  "select-right",
  "select-up",
  "select-down",
  "line-home",
  "line-end",
  "select-line-home",
  "select-line-end",
  "buffer-home",
  "buffer-end",
  "select-buffer-home",
  "select-buffer-end",
  "delete-line",
  "delete-to-line-end",
  "delete-to-line-start",
  "backspace",
  "delete",
  "undo",
  "redo",
  "word-forward",
  "word-backward",
  "select-word-forward",
  "select-word-backward",
  "delete-word-forward",
  "delete-word-backward",
] as const

export function useTextareaKeybindings() {
  const keybind = useKeybind()
  return createMemo(() => {
    const keybinds = keybind.all
    return [
      { name: "return", action: "submit" },
      { name: "return", meta: true, action: "newline" },
      ...TEXTAREA_ACTIONS.flatMap((action) => mapTextareaKeybindings(keybinds, action)),
    ]
  })
}
```

---

## TUI 组件命令

TUI 由多个组件组成，每个组件可能有自己的命令。

### 主应用命令

位置：`packages/opencode/src/cli/cmd/tui/app.tsx`

#### 全局命令注册

```typescript
command.register(() => [
  // Session 命令
  {
    title: "Switch session",
    value: "session.list",
    keybind: "session_list",
    category: "Session",
    slash: { name: "sessions", aliases: ["resume", "continue"] },
    onSelect: () => { dialog.replace(() => <DialogSessionList />) },
  },
  // ... 更多命令
])
```

#### 事件处理

TUI 通过事件系统响应服务器命令：

```typescript
// 处理服务器发送的命令执行事件
sdk.event.on(TuiEvent.CommandExecute.type, (evt) => {
  command.trigger(evt.properties.command)
})

// 显示 Toast 通知
sdk.event.on(TuiEvent.ToastShow.type, (evt) => {
  toast.show({
    title: evt.properties.title,
    message: evt.properties.message,
    variant: evt.properties.variant,
  })
})

// 选择会话
sdk.event.on(TuiEvent.SessionSelect.type, (evt) => {
  route.navigate({
    type: "session",
    sessionID: evt.properties.sessionID,
  })
})
```

### 会话视图命令

位置：`packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`

会话视图注册的命令包括：

```typescript
command.register(() => [
  {
    title: "Share",
    value: "session.share",
    keybind: "session_share",
    category: "Session",
    onSelect: async () => {
      // 分享会话逻辑
    },
  },
  {
    title: "Rename",
    value: "session.rename",
    keybind: "session_rename",
    category: "Session",
    onSelect: () => {
      // 重命名逻辑
    },
  },
  // ... 更多会话特定命令
])
```

### 对话框系统命令

TUI 的对话框系统提供以下功能：

| 对话框               | 触发方式                | 用途            |
| -------------------- | ----------------------- | --------------- |
| `DialogSessionList`  | `session_list` 命令     | 切换会话        |
| `DialogModel`        | `model_list` 命令       | 切换模型        |
| `DialogAgent`        | `agent_list` 命令       | 切换代理        |
| `DialogMcp`          | `mcp.list` 命令         | 切换 MCP 服务器 |
| `DialogProviderList` | `provider.connect` 命令 | 连接提供商      |
| `DialogThemeList`    | `theme.switch` 命令     | 切换主题        |
| `DialogStatus`       | `status_view` 命令      | 查看状态        |
| `DialogHelp`         | `help.show` 命令        | 显示帮助        |
| `DialogCommand`      | `command_list` 命令     | 命令面板        |

### 斜杠命令（Slash Commands）

在提示框中输入 `/` 触发斜杠命令系统：

```
/sessions     # 切换会话
/new          # 新建会话
/models       # 切换模型
/agents       # 切换代理
/mcps         # 切换 MCP
/connect      # 连接提供商
/status       # 查看状态
/themes       # 切换主题
/help         # 显示帮助
/exit         # 退出应用
```

---

## 服务器交互

TUI 与服务器通过多种方式通信：

### 1. 直接 RPC（本地模式）

当使用默认模式时，TUI 通过 RPC 直接与 Web Worker 通信。

```typescript
// 创建自定义 fetch 函数
function createWorkerFetch(client: RpcClient): typeof fetch {
  const fn = async (input, init) => {
    const request = new Request(input, init)
    const body = request.body ? await request.text() : undefined
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
  return fn
}

// 创建事件源
function createEventSource(client: RpcClient): EventSource {
  return {
    on: (handler) => client.on<Event>("event", handler),
  }
}
```

### 2. HTTP API（服务器模式）

当使用 `--port` 选项时，TUI 通过 HTTP API 与服务器通信。

#### TUI API 端点

位置：`packages/opencode/src/server/routes/tui.ts`

| 端点                    | 方法 | 描述               |
| ----------------------- | ---- | ------------------ |
| `/tui/append-prompt`    | POST | 追加提示词到输入框 |
| `/tui/submit-prompt`    | POST | 提交当前提示词     |
| `/tui/clear-prompt`     | POST | 清空提示词         |
| `/tui/open-help`        | POST | 打开帮助对话框     |
| `/tui/open-sessions`    | POST | 打开会话列表对话框 |
| `/tui/open-themes`      | POST | 打开主题对话框     |
| `/tui/open-models`      | POST | 打开模型对话框     |
| `/tui/execute-command`  | POST | 执行 TUI 命令      |
| `/tui/show-toast`       | POST | 显示 Toast 通知    |
| `/tui/publish`          | POST | 发布 TUI 事件      |
| `/tui/select-session`   | POST | 选择会话           |
| `/tui/control/next`     | GET  | 获取下一个控制请求 |
| `/tui/control/response` | POST | 提交控制响应       |

#### API 使用示例

```typescript
// 显示 Toast
await fetch(`${url}/tui/show-toast`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Success",
    message: "Action completed",
    variant: "success",
    duration: 5000,
  }),
})

// 追加提示词
await fetch(`${url}/tui/append-prompt`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "additional text",
  }),
})

// 执行命令
await fetch(`${url}/tui/execute-command`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    command: "agent_cycle",
  }),
})
```

### 3. SSE 事件流

TUI 通过 SSE（Server-Sent Events）接收实时事件：

```typescript
const sdk = createOpencodeClient({
  baseUrl: url,
  directory,
  signal,
})

// 订阅事件流
const events = await sdk.event.subscribe({}, { signal })
for await (const event of events.stream) {
  // 处理事件
  console.log("Event:", event)
}
```

### 事件类型

TUI 支持以下事件类型：

| 事件类型              | 描述           |
| --------------------- | -------------- |
| `tui.prompt.append`   | 追加提示词文本 |
| `tui.command.execute` | 执行命令       |
| `tui.toast.show`      | 显示 Toast     |
| `tui.session.select`  | 选择会话       |

---

## 命令配置

### 配置文件

键盘绑定和命令配置存储在配置文件中。

默认配置位置：

- **macOS/Linux**: `~/.config/opencode/config.json`
- **Windows**: `%APPDATA%\opencode\config.json`

### keybinds 配置

```json
{
  "keybinds": {
    "leader": "space",
    "command_list": "ctrl+p",
    "session_list": "ctrl+l",
    "session_new": "ctrl+n",
    "session_share": "ctrl+s",
    "session_interrupt": "ctrl+c",
    "session_compact": "ctrl+k",
    "session_rename": "ctrl+r",
    "session_timeline": "ctrl+t",
    "session_fork": "ctrl+f",
    "session_unshare": "ctrl+u",
    "session_export": "ctrl+e",
    "session_child_cycle": "]",
    "session_child_cycle_reverse": "[",
    "session_parent": "p",
    "agent_list": "ctrl+a",
    "agent_cycle": "tab",
    "agent_cycle_reverse": "shift+tab",
    "variant_cycle": "ctrl+v",
    "model_list": "ctrl+m",
    "model_cycle_recent": "ctrl+]",
    "model_cycle_recent_reverse": "ctrl+[",
    "model_cycle_favorite": "ctrl+}",
    "model_cycle_favorite_reverse": "ctrl+{",
    "status_view": "ctrl+shift+v",
    "theme_list": "ctrl+shift+t",
    "tips_toggle": "ctrl+h",
    "terminal_suspend": "ctrl+z",
    "terminal_title_toggle": "ctrl+shift+x",
    "input_submit": "enter",
    "input_paste": "ctrl+v",
    "input_clear": "ctrl+w",
    "input_newline": "ctrl+enter",
    "session_interrupt": "ctrl+c",
    "editor_open": "ctrl+e",
    "messages_page_up": "pageup",
    "messages_page_down": "pagedown",
    "messages_line_up": "up",
    "messages_line_down": "down",
    "messages_half_page_up": "ctrl+u",
    "messages_half_page_down": "ctrl+d",
    "messages_first": "home",
    "messages_last": "end",
    "messages_last_user": "ctrl+shift+u",
    "messages_next": "ctrl+n",
    "messages_previous": "ctrl+p",
    "messages_undo": "ctrl+z",
    "messages_redo": "ctrl+y",
    "messages_copy": "ctrl+c",
    "messages_toggle_conceal": "ctrl+shift+m",
    "sidebar_toggle": "ctrl+\\",
    "scrollbar_toggle": "ctrl+|",
    "tool_details": "ctrl+o"
  }
}
```

### 查看当前绑定

在 TUI 中按 `<leader> ?` 或 `Ctrl+P` 打开命令面板，查看所有命令及其快捷键。

### 重置为默认

删除 `keybinds` 配置节可恢复默认绑定：

```json
{
  // 删除此节或设置为空对象
  "keybinds": {}
}
```

---

## 扩展与定制

### 注册自定义命令

开发者可以在 TUI 中注册自定义命令。

#### 在组件中注册命令

```typescript
import { useCommandDialog } from "@tui/component/dialog-command"

function MyComponent() {
  const command = useCommandDialog()

  command.register(() => [
    {
      title: "My Custom Command",
      value: "my.custom",
      category: "Custom",
      slash: { name: "mycmd" },
      keybind: "ctrl+alt+m",
      onSelect: () => {
        // 执行命令逻辑
        console.log("Custom command executed!")
      },
    },
  ])
}
```

#### 创建自定义对话框

```typescript
import { DialogSelect, type DialogSelectRef } from "@tui/ui/dialog-select"

function MyDialog() {
  return (
    <DialogSelect
      ref={(ref) => (dialogRef = ref)}
      title="My Dialog"
      options={[
        { value: "option1", title: "Option 1" },
        { value: "option2", title: "Option 2" },
      ]}
    />
  )
}
```

### 自定义键盘绑定

在配置文件中修改或添加绑定：

```json
{
  "keybinds": {
    "leader": "ctrl+space",
    "my_custom_action": "ctrl+alt+x"
  }
}
```

### 创建自定义键盘处理

```typescript
import { useKeyboard } from "@opentui/solid"
import { useKeybind } from "@tui/context/keybind"

function MyComponent() {
  const keybind = useKeybind()

  useKeyboard((evt) => {
    if (keybind.match("my_custom_action", evt)) {
      evt.preventDefault()
      // 处理自定义按键
    }
  })
}
```

---

## 高级用法

### 键盘快捷键覆盖规则

1. **对话框优先**：当对话框打开时，对话框的键盘绑定优先
2. **输入框优先**：当输入框聚焦时，输入编辑绑定优先
3. **Leader 模式**：Leader Key 可以临时覆盖其他绑定
4. **显式禁用**：设置为 `none` 的绑定不会触发

### 命令提示系统

TUI 提供智能提示：

- **建议命令**：根据上下文显示相关命令
- **快捷键提示**：在界面中显示当前操作的快捷键
- **上下文帮助**：按 `<leader> ?` 查看当前上下文的可用命令

### 多会话导航

使用会话导航命令在相关会话之间跳转：

```
[p]            # 跳转到父会话
]              # 跳转到下一个子会话
[              # 跳转到上一个子会话
Ctrl+L         # 打开会话列表
```

---

## 故障排除

### 快捷键不工作

1. 检查配置文件中的 `keybinds` 节
2. 确认快捷键没有冲突
3. 某些终端可能不支持某些组合键
4. 尝试不同的 Leader Key

### Leader Key 不响应

- 默认 Leader Key 是 `space`
- 如果 `space` 被占用，可以更改：
  ```json
  { "keybinds": { "leader": "ctrl+space" } }
  ```
- Leader 模式在 2 秒后自动取消

### 远程连接失败

1. 确认服务器正在运行
2. 检查 URL 格式：`http://localhost:4096`
3. 如果使用防火墙，确保端口开放
4. 检查服务器认证配置

---

## 参考资源

### 相关文档

- [11-TUI实现详解.md](./11-TUI实现详解.md) - TUI 架构和实现细节
- [15-CLI命令系统详解.md](./15-CLI命令系统详解.md) - CLI 命令系统
- [16-核心命令参考.md](./16-核心命令参考.md) - 所有 CLI 命令参考

### 代码位置

| 组件        | 文件路径                                                              |
| ----------- | --------------------------------------------------------------------- |
| TUI 命令    | `packages/opencode/src/cli/cmd/tui/thread.ts`                         |
| Attach 命令 | `packages/opencode/src/cli/cmd/tui/attach.ts`                         |
| TUI 应用    | `packages/opencode/src/cli/cmd/tui/app.tsx`                           |
| 键盘绑定    | `packages/opencode/src/cli/cmd/tui/context/keybind.tsx`               |
| 命令面板    | `packages/opencode/src/cli/cmd/tui/component/dialog-command.tsx`      |
| 输入绑定    | `packages/opencode/src/cli/cmd/tui/component/textarea-keybindings.ts` |
| TUI 路由    | `packages/opencode/src/server/routes/tui.ts`                          |
| 事件定义    | `packages/opencode/src/cli/cmd/tui/event.ts`                          |

### 外部资源

- [OpenTUI 文档](https://github.com/sst/opentui)
- [SolidJS 文档](https://solidjs.com)
- [OpenCode 官方文档](https://opencode.ai/docs)

---

_文档版本：1.0.0_
_最后更新：2026-01-22_
