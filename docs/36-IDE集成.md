# IDE 集成

## 目录

1. [IDE 集成概述](#ide-集成概述)
2. [VSCode 扩展](#vscode-扩展)
3. [Neovim 插件](#neovim-插件)
4. [LSP 客户端](#lsp-客户端)
5. [编辑器 API](#编辑器-api)
6. [TUI 集成](#tui-集成)
7. [Web 应用](#web-应用)
8. [桌面应用](#桌面应用)
9. [扩展开发](#扩展开发)
10. [最佳实践](#最佳实践)

---

## IDE 集成概述

OpenCode 提供多种 IDE 集成方式，允许开发者在熟悉的工作环境中使用 AI 代理。从终端 UI 到 VSCode 扩展，从 Neovim 插件到 Web 应用，OpenCode 提供灵活的集成选项。

### 集成方式

| 集成方式              | 用途              | 适用场景                       |
| --------------------- | ----------------- | ------------------------------ |
| **TUI (Terminal UI)** | 主终端界面        | 命令行用户、SSH 远程开发       |
| **VSCode 扩展**       | VSCode/VS Code UI | 桌面 IDE 用户、图形界面交互    |
| **Neovim 插件**       | Neovim 集成       | 终端编辑器用户、键盘驱动工作流 |
| **LSP 客户端**        | 语言服务集成      | 需要代码智能的用户             |
| **Web 应用**          | 浏览器界面        | 跨平台访问、协作场景           |
| **桌面应用**          | 原生应用          | 独立运行、系统集成             |

### 技术架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OpenCode Ecosystem                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  │     TUI     │  │   VSCode    │  │   Neovim    │
│  │   Client     │  │ Extension   │  │   Plugin     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
│         │                  │                  │
└─────────┼──────────────────┼──────────────────┘
          │                  │
    ┌─────┴──────────────────┴─────┐
    │     OpenCode Server          │
    │     (REST API + SSE)       │
    └─────┬──────────────────────┘
          │
    ┌─────┴────────────┐
    │  AI Models      │
    │  LSP Layer     │
    │  Tool System   │
    └────────────────┘
```

### 统一 API

所有 IDE 客户端通过统一的 API 与 OpenCode 服务器通信：

```typescript
// @opencode-ai/sdk
import { createOpencode } from "@opencode-ai/sdk"

// 创建客户端
const opencode = await createOpencode({
  port: 19876, // 默认端口
})

// 访问 API
const { client, server } = opencode

// 会话管理
await client.session.create({ body: { title: "My Session" } })
await client.session.prompt({ path: { id: sessionId }, body: { parts: [...] } })

// 事件订阅
const events = await client.event.subscribe()
for await (const event of events.stream) {
  console.log(event)
}
```

---

## VSCode 扩展

### 扩展概述

OpenCode 提供 VSCode 扩展，将 AI 代理功能集成到 VSCode 界面中。扩展提供：

- **侧边栏面板**：显示会话历史和消息
- **命令面板**：快速访问常用操作
- **状态栏指示**：显示代理状态
- **代码内联提示**：悬停和补全
- **问题面板集成**：显示错误和警告

### 安装扩展

#### 方式 1：通过扩展市场

```bash
# 1. 打开 VSCode
# 2. 按 Ctrl+Shift+X (Cmd+Shift+X)
# 3. 搜索 "OpenCode"
# 4. 点击 "Install"
```

#### 方式 2：通过 VSIX 文件

```bash
# 下载扩展
wget https://github.com/anomalyco/opencode/releases/latest/download/opencode.vsix

# 安装扩展
code --install-extension opencode.vsix
```

#### 方式 3：开发模式

```bash
# 克隆仓库
git clone https://github.com/anomalyco/opencode.git
cd opencode

# 安装依赖
cd packages/vscode
npm install

# 编译扩展
npm run compile

# 调试运行
npm run dev
```

### 扩展配置

在 VSCode 设置中配置 OpenCode：

```json
{
  // 服务器地址
  "opencode.serverUrl": "http://localhost:19876",

  // 自动连接
  "opencode.autoConnect": true,

  // 默认模型
  "opencode.defaultModel": "anthropic/claude-sonnet-4-20250514",

  // 会话持久化
  "opencode.persistSessions": true,

  // 通知设置
  "opencode.notifications": {
    "enabled": true,
    "sound": false
  },

  // UI 设置
  "opencode.ui": {
    "theme": "dark",
    "fontSize": 14,
    "maxHistory": 50
  }
}
```

### 扩展命令

| 命令                            | ID                      | 描述                 |
| ------------------------------- | ----------------------- | -------------------- |
| **OpenCode: Start**             | `opencode.start`        | 启动 OpenCode 服务器 |
| **OpenCode: New Session**       | `opencode.newSession`   | 创建新会话           |
| **OpenCode: Attach to Session** | `opencode.attach`       | 连接到现有会话       |
| **OpenCode: Clear Context**     | `opencode.clearContext` | 清除会话上下文       |
| **OpenCode: Export Session**    | `opencode.export`       | 导出会话内容         |
| **OpenCode: Settings**          | `opencode.settings`     | 打开设置面板         |

### 快捷键绑定

```json
{
  "key": "ctrl+shift+o",
  "command": "opencode.newSession"
},
{
  "key": "ctrl+shift+a",
  "command": "opencode.attach"
},
{
  "key": "ctrl+shift+c",
  "command": "opencode.clearContext"
}
```

### 侧边栏面板

```typescript
// packages/vscode/src/panel.ts
import * as vscode from "vscode"
import { createOpencode } from "@opencode-ai/sdk"

class OpenCodePanel {
  private static currentPanel: OpenCodePanel | undefined
  private readonly panel: vscode.WebviewPanel
  private disposables: vscode.Disposable[] = []

  constructor(panel: vscode.WebviewPanel) {
    this.panel = panel

    // 设置 Webview 内容
    this.panel.webview.html = this.getWebviewContent()

    // 监听消息
    this.panel.webview.onDidReceiveMessage((message) => this.handleMessage(message))

    this.disposables.push(this.panel.onDidDispose(() => this.dispose()))
  }

  private async handleMessage(message: any) {
    switch (message.type) {
      case "createSession":
        await this.createSession(message.title)
        break
      case "sendPrompt":
        await this.sendPrompt(message.sessionId, message.prompt)
        break
    }
  }

  static createOrShow() {
    if (OpenCodePanel.currentPanel) {
      OpenCodePanel.currentPanel.panel.reveal()
      return
    }

    const panel = vscode.window.createWebviewPanel("opencode", "OpenCode", vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    })

    OpenCodePanel.currentPanel = new OpenCodePanel(panel)
  }

  dispose() {
    this.panel.dispose()
    this.disposables.forEach((d) => d.dispose())
    OpenCodePanel.currentPanel = undefined
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("opencode.showPanel", () => {
      OpenCodePanel.createOrShow()
    }),
  )
}
```

### 代码内联提示

```typescript
// packages/vscode/src/hover.ts
class HoverProvider implements vscode.HoverProvider {
  async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
    // 获取选中的代码
    const range = document.getWordRangeAtPosition(position)
    const code = document.getText(range)

    // 请求 AI 解释
    const explanation = await explainCode(code)

    // 创建 Hover 内容
    const markdown = new vscode.MarkdownString()
    markdown.appendMarkdown(`\`\`\`\`\n${explanation}\n\`\`\`\``)

    return new vscode.Hover(markdown, range)
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new HoverProvider()

  context.subscriptions.push(vscode.languages.registerHoverProvider({ scheme: "file", language: "*" }, provider))
}
```

---

## Neovim 插件

### 插件概述

OpenCode 提供 Neovim 插件，在终端编辑器中提供 AI 辅助功能。插件特性：

- **浮动窗口**：显示 AI 对话和代码补全
- **命令系统**：`:OC` 命令系列
- **异步请求**：非阻塞的 AI 交互
- **LSP 集成**：代码诊断和补全
- **语法高亮**：AI 代码建议高亮

### 安装插件

#### 方式 1：使用 Lazy.nvim

```lua
-- ~/.config/nvim/init.lua
require('lazy').setup({
  spec = {
    {
      'anomalyco/opencode.nvim',
      lazy = false,
      config = function()
        require('opencode').setup({
          server_url = 'http://localhost:19876',
          auto_connect = true,
        })
      end
    }
  }
})
```

#### 方式 2：使用 packer.nvim

```lua
-- ~/.config/nvim/init.lua
require('packer').startup(function()
  use {
    'anomalyco/opencode.nvim',
    config = function()
      require('opencode').setup({
        server_url = 'http://localhost:19876',
      })
    end
  }
end)
```

#### 方式 3：手动安装

```bash
# 克隆插件
git clone https://github.com/anomalyco/opencode.nvim \
  ~/.local/share/nvim/site/pack/opencode/start/opencode

# 或使用 Plug
Plug 'anomalyco/opencode.nvim'
```

### 插件配置

```lua
require('opencode').setup({
  -- 服务器配置
  server_url = 'http://localhost:19876',
  auto_connect = true,

  -- UI 配置
  ui = {
    float = true,
    width = 80,
    height = 40,
    border = 'rounded',
    focus = true,
  },

  -- 快捷键配置
  keymaps = {
    toggle = '<leader>oc',
    send = '<C-CR>',
    clear = '<leader>occ',
    attach = '<leader>oca',
  },

  -- LSP 集成
  lsp = {
    enabled = true,
    hover = true,
    completion = true,
  },

  -- 通知配置
  notify = {
    enabled = true,
    timeout = 5000,
  },
})
```

### 命令系统

| 命令             | 描述                   | 示例               |
| ---------------- | ---------------------- | ------------------ |
| `:OCOpen`        | 打开 OpenCode 浮动窗口 | `:OCOpen`          |
| `:OCClose`       | 关闭浮动窗口           | `:OCClose`         |
| `:OCSend`        | 发送当前提示词         | `:OCSend`          |
| `:OCClear`       | 清除上下文             | `:OCClear`         |
| `:OCAttach [id]` | 连接到会话             | `:OCAttach abc123` |
| `:OCNew`         | 创建新会话             | `:OCNew`           |
| `:OCExport`      | 导出会话               | `:OCExport`        |

### 浮动窗口

```lua
-- lua/opencode/ui.lua
local M = {}

function M.open_window()
  -- 创建浮动窗口
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_option(buf, 'filetype', 'markdown')

  local win = vim.api.nvim_open_win(buf, true, {
    relative = 'editor',
    width = 80,
    height = 40,
    row = 10,
    col = 20,
    style = 'minimal',
    border = 'rounded',
  })

  -- 设置窗口选项
  vim.api.nvim_win_set_option(win, 'wrap', true)
  vim.api.nvim_win_set_option(win, 'linebreak', true)

  -- 添加自动命令
  vim.api.nvim_create_autocmd('BufLeave', {
    buffer = buf,
    callback = function()
      M.close_window()
    end,
  })

  return win, buf
end

function M.append_message(message)
  local win = M.get_window()
  local buf = vim.api.nvim_win_get_buf(win)

  -- 追加消息
  local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
  table.insert(lines, message)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)

  -- 滚动到底部
  vim.api.nvim_win_set_cursor(win, { vim.api.nvim_buf_line_count(buf), 0 })
end

return M
```

### 快捷键绑定

```lua
-- lua/opencode/keymaps.lua
local M = {}

function M.setup(config)
  local opts = { noremap = true, silent = true }

  -- 切换窗口
  vim.keymap.set('n', config.keymaps.toggle, '<cmd>lua require("opencode.ui").toggle()<CR>', opts)

  -- 发送提示词
  vim.keymap.set('i', config.keymaps.send, '<cmd>lua require("opencode.ui").send()<CR>', opts)

  -- 清除上下文
  vim.keymap.set('n', config.keymaps.clear, '<cmd>lua require("opencode.ui").clear()<CR>', opts)

  -- 连接到会话
  vim.keymap.set('n', config.keymaps.attach, '<cmd>lua require("opencode.ui").attach()<CR>', opts)
end

return M
```

### LSP 集成

```lua
-- lua/opencode/lsp.lua
local M = {}

function M.setup()
  -- 注册 Hover 处理器
  vim.api.nvim_create_autocmd('CursorHold', {
    callback = function()
      M.handle_hover()
    end,
  })

  -- 注册 Completion 处理器
  vim.api.nvim_create_autocmd('InsertEnter', {
    callback = function()
      M.enable_completion()
    end,
  })
end

function M.handle_hover()
  local pos = vim.api.nvim_win_get_cursor(0)
  local word = vim.api.nvim_buf_get_text(0, pos[1] - 1, pos[2] - 1, pos[1] - 1, pos[2] + 10)

  -- 请求 AI 解释
  local explanation = require('opencode.client').explain(word)

  -- 显示浮动窗口
  vim.lsp.util.open_floating_preview(explanation, 'markdown')
end

function M.enable_completion()
  -- 启用补全源
  vim.api.nvim_command('lua require("opencode.completion").setup()')
end

return M
```

---

## LSP 客户端

### LSP 概述

OpenCode 内置 Language Server Protocol (LSP) 支持，自动为项目语言启动相应的语言服务器，并提供代码智能功能。

### 支持的语言服务器

| 语言                      | LSP 服务器                 | 自动检测 |
| ------------------------- | -------------------------- | -------- |
| **TypeScript/JavaScript** | TypeScript Language Server | ✅       |
| **Python**                | Pyright                    | ✅       |
| **Go**                    | gopls                      | ✅       |
| **Rust**                  | rust-analyzer              | ✅       |
| **C/C++**                 | clangd                     | ✅       |
| **Java**                  | jdt.ls                     | ✅       |
| **Ruby**                  | solargraph                 | ✅       |
| **Elixir**                | elixir-ls                  | ✅       |
| **PHP**                   | intelephense               | ✅       |
| **Lua**                   | lua-language-server        | ✅       |
| **Kotlin**                | kotlin-language-server     | ✅       |
| **Terraform**             | terraform-ls               | ✅       |
| **LaTeX**                 | texlab                     | ✅       |
| **Nix**                   | nil                        | ✅       |

### LSP 功能

| 功能           | 描述               | LSP 方法                          |
| -------------- | ------------------ | --------------------------------- |
| **代码补全**   | 智能代码建议       | `textDocument/completion`         |
| **定义跳转**   | 跳转到符号定义     | `textDocument/definition`         |
| **引用查找**   | 查找所有引用       | `textDocument/references`         |
| **符号搜索**   | 搜索文档符号       | `textDocument/documentSymbol`     |
| **工作区搜索** | 搜索整个工作区符号 | `workspace/symbol`                |
| **悬停提示**   | 显示类型和文档     | `textDocument/hover`              |
| **诊断信息**   | 显示错误和警告     | `textDocument/publishDiagnostics` |
| **代码重命名** | 重命名符号         | `textDocument/rename`             |

### LSP 配置

```json
{
  "lsp": {
    // 全局启用/禁用
    "enabled": true,

    // 特定语言配置
    "typescript": {
      "command": ["typescript-language-server", "--stdio"],
      "extensions": [".ts", ".tsx", ".js", ".jsx"],
      "enabled": true
    },
    "python": {
      "command": ["pyright-langserver", "--stdio"],
      "extensions": [".py"],
      "enabled": true
    },

    // 自定义服务器
    "custom": {
      "my-language": {
        "command": ["my-lang-server"],
        "extensions": [".mylang"],
        "rootMarkers": [".mylangrc", "package.json"]
      }
    }
  }
}
```

### LSP 工具使用

OpenCode 通过工具提供 LSP 功能：

```typescript
// 代码补全
await tools.lsp_completion({
  filePath: "/path/to/file.ts",
  line: 10,
  character: 5,
})

// 定义跳转
await tools.lsp_goto_definition({
  filePath: "/path/to/file.ts",
  line: 10,
  character: 5,
})

// 引用查找
await tools.lsp_find_references({
  filePath: "/path/to/file.ts",
  line: 10,
  character: 5,
})

// 符号搜索
await tools.lsp_symbols({
  filePath: "/path/to/file.ts",
  query: "function",
})
```

### LSP 客户端实现

```typescript
// packages/opencode/src/lsp/client.ts
import { createMessageConnection, IPCMessageReader, IPCMessageWriter } from "vscode-jsonrpc"

export class LSPClient {
  private connection: any
  private initialized = false

  constructor(
    private readonly command: string[],
    private readonly args: string[],
    private readonly root: string,
  ) {}

  async start() {
    // 启动 LSP 服务器
    const process = spawn(this.command[0], this.args, {
      cwd: this.root,
      stdio: [null, null, null],
    })

    // 创建 JSON-RPC 连接
    this.connection = createMessageConnection(new IPCMessageReader(process.stdout), new IPCMessageWriter(process.stdin))

    // 监听消息
    this.connection.listen()

    // 初始化
    await this.initialize()

    // 通知能力
    this.connection.sendNotification("initialized", {})
  }

  private async initialize() {
    const capabilities = {
      textDocument: {
        completion: {
          completionItem: {
            snippetSupport: true,
            commitCharactersSupport: true,
          },
        },
        hover: {
          contentFormat: ["markdown", "plaintext"],
        },
        definition: {
          linkSupport: true,
        },
        references: {},
      },
      workspace: {
        symbol: {
          dynamicRegistration: false,
        },
      },
    }

    await this.connection.sendRequest("initialize", {
      processId: process.pid,
      rootPath: this.root,
      capabilities,
    })

    this.initialized = true
  }

  async completion(filePath: string, line: number, character: number) {
    const result = await this.connection.sendRequest("textDocument/completion", {
      textDocument: {
        uri: `file://${filePath}`,
        version: 1,
      },
      position: { line, character },
    })

    return result
  }

  async definition(filePath: string, line: number, character: number) {
    const result = await this.connection.sendRequest("textDocument/definition", {
      textDocument: {
        uri: `file://${filePath}`,
        version: 1,
      },
      position: { line, character },
    })

    return result
  }

  async shutdown() {
    await this.connection.sendRequest("shutdown")
    this.connection.dispose()
  }
}
```

---

## 编辑器 API

### API 概述

OpenCode 提供统一的编辑器 API，允许 IDE 客户端与服务器交互。

### 核心 API

#### 会话管理

```typescript
// 创建会话
const result = await client.session.create({
  body: {
    title: "My Session",
    metadata: {
      editor: "vscode",
      workspace: "/path/to/project",
    },
  },
})

// 发送提示词
const prompt = await client.session.prompt({
  path: { id: sessionId },
  body: {
    parts: [{ type: "text", text: "Help me write a function" }],
  },
})

// 删除会话
await client.session.delete({
  path: { id: sessionId },
})
```

#### 事件订阅

```typescript
// 订阅事件流
const events = await client.event.subscribe()

for await (const event of events.stream) {
  switch (event.type) {
    case "session.created":
      console.log("New session:", event.properties)
      break
    case "message.part.updated":
      console.log("Message update:", event.properties)
      break
    case "agent.started":
      console.log("Agent started")
      break
  }
}
```

#### 工具执行

```typescript
// 执行工具（需要权限）
const result = await client.tool.execute({
  body: {
    tool: "bash",
    arguments: {
      command: "ls -la",
    },
  },
})

// 获取可用工具列表
const tools = await client.tool.list()
```

#### 文件操作

```typescript
// 读取文件
const file = await client.file.read({
  path: { filePath: "/path/to/file.ts" },
})

// 写入文件
await client.file.write({
  path: { filePath: "/path/to/file.ts" },
  body: {
    content: "const x = 1",
  },
})

// 搜索文件
const results = await client.file.search({
  path: { directory: "/path/to/project" },
  body: {
    query: "function",
  },
})
```

### 认证 API

```typescript
// 登录
const login = await client.auth.login({
  body: {
    email: "user@example.com",
    password: "password",
  },
})

// 获取会话信息
const session = await client.auth.session()

// 登出
await client.auth.logout()
```

### WebSocket 连接

```typescript
import { WebSocket } from "ws"

const ws = new WebSocket("ws://localhost:19876/ws")

ws.on("open", () => {
  console.log("Connected to OpenCode")
})

ws.on("message", (data) => {
  const message = JSON.parse(data.toString())
  console.log("Received:", message)
})

ws.on("error", (error) => {
  console.error("WebSocket error:", error)
})

ws.on("close", () => {
  console.log("Disconnected from OpenCode")
})
```

---

## TUI 集成

### TUI 概述

OpenCode 的终端用户界面 (TUI) 是主要的交互方式，提供基于终端的 AI 代理界面。

### 启动 TUI

```bash
# 基本使用
opencode

# 指定项目目录
opencode /path/to/project

# 指定配置文件
opencode --config /path/to/config.json

# 调试模式
opencode --debug
```

### TUI 布局

```
┌─────────────────────────────────────────────────────────────────┐
│ OpenCode - My Project                           [build ▼] │
├─────────────────────────────────────────────────────────────────┤
│                                                         │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ Message History                                    │   │
│ │                                                   │   │
│ │ User: Help me write a function to sort array       │   │
│ │                                                   │   │
│ │ AI: Sure! Here's a sorting function:             │   │
│ │     function sortArray(arr) {                       │   │
│ │       return arr.sort((a, b) => a - b)            │   │
│ │     }                                            │   │
│ │                                                   │   │
│ │ User: Can you explain how it works?                 │   │
│ │                                                   │   │
│ │ ─────────────────────────────────────────────────     │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                         │
│ [help] [settings] [sessions] [export] [quit]                │
└─────────────────────────────────────────────────────────────────┘
```

### TUI 命令

| 命令        | 快捷键 | 描述       |
| ----------- | ------ | ---------- |
| `/help`     | `?`    | 显示帮助   |
| `/settings` | `s`    | 打开设置   |
| `/sessions` | `o`    | 列出会话   |
| `/new`      | `n`    | 创建新会话 |
| `/attach`   | `a`    | 连接到会话 |
| `/clear`    | `c`    | 清除上下文 |
| `/export`   | `e`    | 导出会话   |
| `/quit`     | `q`    | 退出       |

### 键盘快捷键

| 动作     | 快捷键        |
| -------- | ------------- |
| 发送消息 | `Enter`       |
| 新行     | `Shift+Enter` |
| 向上滚动 | `Ctrl+U`      |
| 向下滚动 | `Ctrl+D`      |
| 搜索历史 | `Ctrl+R`      |
| 切换代理 | `Tab`         |
| 查看工具 | `T`           |
| 查看诊断 | `D`           |

---

## Web 应用

### Web 应用概述

OpenCode 提供基于浏览器的 Web 应用，支持跨平台访问和远程协作。

### 访问 Web 应用

```bash
# 启动服务器
opencode serve

# 访问浏览器
# 默认: http://localhost:19876
```

### Web 应用架构

```
┌─────────────────────────────────────────────────────────────────┐
│                   Web Browser                          │
├─────────────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         OpenCode Web UI                          │   │
│  │  ┌───────────────┐  ┌────────────────────┐  │   │
│  │  │  Chat Panel   │  │  File Explorer    │  │   │
│  │  │               │  │                  │  │   │
│  │  └───────────────┘  └────────────────────┘  │   │
│  │                                                 │   │
│  │  ┌───────────────┐  ┌────────────────────┐  │   │
│  │  │  Code Editor  │  │  Tool Output     │  │   │
│  │  │               │  │                  │  │   │
│  │  └───────────────┘  └────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                         ↓
              ┌────────────────┐
              │ HTTP/WebSocket│
              └────────────────┘
                         ↓
              ┌────────────────┐
              │ OpenCode      │
              │ Server        │
              └────────────────┘
```

### Web 应用特性

| 特性           | 描述               |
| -------------- | ------------------ |
| **响应式设计** | 支持桌面和移动设备 |
| **实时更新**   | WebSocket 实时通信 |
| **代码编辑器** | Monaco Editor 集成 |
| **文件浏览器** | 查看和编辑文件     |
| **会话管理**   | 多会话并行         |
| **分享功能**   | 生成会话分享链接   |
| **主题切换**   | 支持明暗主题       |

### Web 应用 API

```typescript
// packages/web/src/api/client.ts
import { createOpencode } from "@opencode-ai/sdk"

class OpenCodeWebClient {
  private opencode: any
  private currentSession: string | null = null

  async connect() {
    this.opencode = await createOpencode({
      port: 19876,
    })
  }

  async createSession(title: string) {
    const result = await this.opencode.client.session.create({
      body: { title },
    })

    if (!result.error) {
      this.currentSession = result.data.id
    }

    return result
  }

  async sendMessage(text: string) {
    if (!this.currentSession) return

    return await this.opencode.client.session.prompt({
      path: { id: this.currentSession },
      body: { parts: [{ type: "text", text }] },
    })
  }

  async subscribeToEvents(callback: (event: any) => void) {
    const events = await this.opencode.client.event.subscribe()

    for await (const event of events.stream) {
      callback(event)
    }
  }
}
```

---

## 桌面应用

### 桌面应用概述

OpenCode 提供基于 Tauri 的原生桌面应用，支持系统集成和离线使用。

### 下载桌面应用

```bash
# macOS (Apple Silicon)
wget https://github.com/anomalyco/opencode/releases/latest/download/opencode-desktop-darwin-aarch64.dmg

# macOS (Intel)
wget https://github.com/anomalyco/opencode/releases/latest/download/opencode-desktop-darwin-x64.dmg

# Windows
wget https://github.com/anomalyco/opencode/releases/latest/download/opencode-desktop-windows-x64.exe

# Linux (DEB)
wget https://github.com/anomalyco/opencode/releases/latest/download/opencode-desktop-linux-amd64.deb

# Linux (RPM)
wget https://github.com/anomalyco/opencode/releases/latest/download/opencode-desktop-linux-amd64.rpm
```

### 桌面应用特性

| 特性         | 平台                | 说明         |
| ------------ | ------------------- | ------------ |
| **原生菜单** | macOS/Windows/Linux | 系统托盘菜单 |
| **快捷键**   | macOS/Windows/Linux | 全局快捷键   |
| **通知**     | macOS/Windows/Linux | 系统通知     |
| **文件关联** | macOS/Windows/Linux | 关联代码文件 |
| **离线模式** | 所有                | 部分离线支持 |

### 桌面应用配置

```json
{
  "window": {
    "width": 1200,
    "height": 800,
    "resizable": true,
    "fullscreen": false
  },
  "tray": {
    "enabled": true,
    "showOnStartup": true
  },
  "notifications": {
    "enabled": true,
    "sound": true
  },
  "hotkey": {
    "enabled": true,
    "shortcut": "Cmd+Shift+O"
  }
}
```

---

## 扩展开发

### 创建自定义 IDE 集成

#### 步骤 1：初始化项目

```bash
# 创建 VSCode 扩展
npm init -y opencode-vscode

# 创建 Neovim 插件
mkdir opencode.nvim
cd opencode.nvim
```

#### 步骤 2：安装依赖

```bash
# VSCode 扩展
npm install @opencode-ai/sdk vscode-languageclient

# Neovim 插件
# 无需额外依赖
```

#### 步骤 3：实现客户端

```typescript
// VSCode 扩展开
import * as vscode from "vscode"
import { createOpencode } from "@opencode-ai/sdk"

export async function activate(context: vscode.ExtensionContext) {
  // 创建 OpenCode 客户端
  const opencode = await createOpencode({
    port: 19876,
  })

  // 注册命令
  const disposable = vscode.commands.registerCommand("opencode.newSession", async () => {
    const result = await opencode.client.session.create({
      body: { title: "VSCode Session" },
    })

    vscode.window.showInformationMessage(`Session created: ${result.data.id}`)
  })

  context.subscriptions.push(disposable)
}

export function deactivate() {}
```

```lua
-- Neovim 插件
local M = {}

function M.setup(config)
  -- 配置
  vim.g.opencode_server_url = config.server_url or 'http://localhost:19876'

  -- 定义命令
  vim.api.nvim_create_user_command('OCNew', function()
    -- 创建会话逻辑
    vim.notify('Session created')
  end, {})
end

return M
```

#### 步骤 4：打包和发布

```bash
# VSCode 扩展
npm run package
# 生成 opencode-vscode.vsix

# Neovim 插件
git add .
git commit -m "Initial commit"
git push origin main
```

### 扩展 API 参考

#### 会话 API

```typescript
interface SessionAPI {
  create(body: SessionCreateRequest): Promise<SessionCreateResponse>
  prompt(path: SessionPath, body: SessionPromptRequest): Promise<SessionPromptResponse>
  delete(path: SessionPath): Promise<void>
  list(): Promise<SessionListResponse>
}

interface SessionCreateRequest {
  title: string
  metadata?: Record<string, any>
}

interface SessionPromptRequest {
  parts: MessagePart[]
}
```

#### 事件 API

```typescript
interface EventAPI {
  subscribe(): Promise<EventStream>
}

interface EventStream {
  stream: AsyncIterable<Event>
}

type Event = SessionCreatedEvent | MessagePartUpdatedEvent | AgentStartedEvent
```

---

## 最佳实践

### IDE 选择建议

| 场景           | 推荐集成               |
| -------------- | ---------------------- |
| 命令行用户     | TUI                    |
| 图形界面用户   | VSCode 扩展 / 桌面应用 |
| 终端编辑器用户 | Neovim 插件            |
| 远程协作       | Web 应用               |
| 跨平台使用     | 桌面应用               |

### 性能优化

1. **按需连接**：只在需要时连接到服务器
2. **缓存结果**：缓存常用查询结果
3. **异步处理**：长时间操作异步执行
4. **资源管理**：及时清理未使用的资源

### 错误处理

```typescript
try {
  const result = await client.session.create({
    body: { title: "My Session" },
  })

  if (result.error) {
    console.error("Failed to create session:", result.error)
    return
  }

  // 使用 result.data
} catch (error) {
  console.error("Network error:", error)
  // 显示友好的错误消息
}
```

### 安全实践

1. **认证**：使用安全的认证机制
2. **验证**：验证服务器身份
3. **加密**：使用 HTTPS/TLS
4. **密钥**：安全存储 API 密钥

### 故障排除

| 问题             | 原因         | 解决方案             |
| ---------------- | ------------ | -------------------- |
| 无法连接到服务器 | 服务器未运行 | 启动 OpenCode 服务器 |
| 认证失败         | 无效凭据     | 检查 API 密钥        |
| LSP 不工作       | 服务器未启动 | 检查语言服务器配置   |
| 消息延迟         | 网络问题     | 检查网络连接         |

---

## 参考资源

- **OpenCode SDK**：https://opencode.ai/docs/sdk/
- **VSCode 扩展 API**：https://code.visualstudio.com/api
- **Neovim Lua API**：https://neovim.io/doc/user/lua.html
- **LSP 规范**：https://microsoft.github.io/language-server-protocol/
- **Tauri 文档**：https://tauri.app/v1/guides/

---

_文档版本：1.0.0_
_最后更新：2026-01-22_
