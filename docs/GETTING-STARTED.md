# OpenCode 开发入门指南

## 目录

1. [项目概述](#项目概述)
2. [架构概览](#架构概览)
3. [开发环境搭建](#开发环境搭建)
4. [项目结构](#项目结构)
5. [核心技术栈](#核心技术栈)
6. [核心概念](#核心概念)
7. [开发工作流](#开发工作流)
8. [调试技巧](#调试技巧)
9. [常见开发任务](#常见开发任务)
10. [贡献指南](#贡献指南)

---

## 项目概述

OpenCode 是一个开源的 AI 编码助手，采用客户端-服务器架构，提供终端用户界面（TUI）和 Web 界面。它支持多种 AI 模型提供商，通过 MCP（Model Context Protocol）协议集成各种工具和服务。

### 主要特性

- **多 AI 提供商支持**：Anthropic、OpenAI、Google、Azure、Mistral、Groq、Together AI 等
- **智能代理系统**：内置多个专业化代理（build、plan、explore、general 等）
- **LSP 支持**：内置 Language Server Protocol 支持，提供代码智能感知
- **MCP 集成**：支持 MCP 服务器和工具
- **多界面**：TUI（基于 OpenTUI）、Web 应用、桌面应用
- **会话管理**：完整的会话历史、后台任务、进度追踪
- **权限系统**：细粒度的权限控制和安全机制

### 项目地址

- **仓库**：https://github.com/anomalyco/opencode
- **文档**：https://opencode.ai/docs
- **社区**：[Discord](https://opencode.ai/discord) | [X.com](https://x.com/opencode)

---

## 架构概览

OpenCode 采用模块化的 monorepo 架构，核心组件包括：

### 高层架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │   TUI    │  │   Web    │  │ Desktop  │                │
│  │(OpenTUI) │  │(SolidJS) │  │ (Tauri)  │                │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                │
└───────┼─────────────┼─────────────┼───────────────────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
        ┌─────────────┴─────────────┐
        │      HTTP/WebSocket      │
        │    @opencode-ai/sdk     │
        └─────────────┬─────────────┘
                      │
        ┌─────────────┴─────────────┐
        │      OpenCode Server      │
        │     (packages/opencode)   │
        │  ┌─────────────────────┐ │
        │  │   Hono Web Server   │ │
        │  │  SSE/WebSocket API  │ │
        │  └─────────────────────┘ │
        └─────────────┬─────────────┘
                      │
        ┌─────────────┴──────────────────────────────────┐
        │              核心子系统                          │
        ├─────────────────┬─────────────┬───────────────┤
        │    Agent System│   Tool Layer │   LSP Layer  │
        │  (代理编排)     │  (工具系统)   │ (语言服务协议) │
        ├─────────────────┼─────────────┼───────────────┤
        │   MCP Layer    │   Session    │   Storage    │
        │ (MCP 协议层)   │  (会话管理)   │  (数据存储)   │
        ├─────────────────┼─────────────┼───────────────┤
        │  Permission    │   Provider   │   Auth       │
        │  (权限系统)     │ (模型提供商)   │ (身份认证)    │
        └─────────────────┴─────────────┴───────────────┘
                      │
        ┌─────────────┴──────────────────────────────────┐
        │           外部服务与依赖                        │
        ├─────────────────┬─────────────┬───────────────┤
        │  AI Providers  │   MCP Server │  File System  │
        │ (Claude/GPT...)│ (外部工具)    │  (文件系统)    │
        ├─────────────────┴─────────────┴───────────────┤
        │   Git/Version Control  |  IDE Integration     │
        └────────────────────────────────────────────────┘
```

### 核心组件说明

#### 1. **Server（服务器核心）**

- **位置**：`packages/opencode/src/server/server.ts`
- **技术栈**：Hono (HTTP 框架)
- **职责**：
  - 提供 REST API 和 SSE (Server-Sent Events) 端点
  - 处理客户端请求（会话、工具、配置等）
  - 管理实时事件流（WebSocket/SSE）
  - 认证和授权
  - CORS 处理

#### 2. **Agent System（代理系统）**

- **位置**：`packages/opencode/src/agent/agent.ts`
- **职责**：
  - 定义和管理 AI 代理
  - 代理权限配置
  - 代理调度和编排
  - 子代理管理
- **内置代理**：
  - `build`：默认开发代理，完整访问权限
  - `plan`：只读代理，用于代码分析和规划
  - `general`：通用子代理，用于复杂任务
  - `explore`：代码探索代理，专注于查找和分析
  - `compaction`、`title`、`summary`：内部实用代理

#### 3. **Tool System（工具系统）**

- **位置**：`packages/opencode/src/tool/tool.ts`
- **职责**：
  - 定义工具接口和元数据
  - 参数验证（使用 Zod）
  - 工具执行和结果格式化
  - 权限检查
- **核心工具**：
  - `bash`：执行 shell 命令
  - `edit`：编辑文件
  - `read`、`write`：文件读写
  - `glob`、`grep`：代码搜索
  - `webfetch`、`websearch`：网络请求和搜索
  - `lsp_*`：LSP 相关工具

#### 4. **MCP Integration（MCP 集成）**

- **位置**：`packages/opencode/src/mcp/`
- **技术栈**：`@modelcontextprotocol/sdk`
- **职责**：
  - MCP 服务器连接管理
  - 工具注册和调用
  - 资源访问
  - 提示词模板管理

#### 5. **LSP Layer（LSP 层）**

- **位置**：`packages/opencode/src/lsp/`
- **职责**：
  - LSP 客户端连接
  - 代码智能（补全、定义查找、引用查找等）
  - 诊断信息获取
  - 符号解析

#### 6. **Session Management（会话管理）**

- **位置**：`packages/opencode/src/session/`
- **职责**：
  - 会话创建和生命周期管理
  - 消息存储和检索
  - 事件流管理
  - 会话持久化

#### 7. **Permission System（权限系统）**

- **位置**：`packages/opencode/src/permission/next.ts`
- **职责**：
  - 权限规则定义和评估
  - 基于模式的访问控制
  - 用户交互（请求权限）
  - 代理权限隔离

#### 8. **Storage Layer（存储层）**

- **位置**：`packages/opencode/src/storage/`
- **职责**：
  - 键值存储
  - 会话数据持久化
  - 配置存储

### 客户端架构

#### TUI（终端用户界面）

- **技术栈**：SolidJS + OpenTUI
- **位置**：`packages/opencode/src/cli/cmd/tui/`
- **职责**：
  - 终端渲染
  - 键盘交互
  - 消息显示
  - 进度指示

#### Web 应用

- **技术栈**：SolidJS + Vite + Tailwind CSS
- **位置**：`packages/app/`
- **职责**：
  - Web 界面
  - 实时通信（WebSocket）
  - 响应式设计

#### 桌面应用

- **技术栈**：Tauri + SolidJS
- **位置**：`packages/desktop/`
- **职责**：
  - 原生应用包装
  - 平台特定功能
  - 本地存储

---

## 开发环境搭建

### 前置要求

1. **Bun 1.3+**

   ```bash
   bun --version  # 确保 >= 1.3
   ```

2. **Node.js 环境**（可选，用于某些工具）

   ```bash
   node --version
   npm --version
   ```

3. **Git**
   ```bash
   git --version
   ```

### 安装步骤

1. **克隆仓库**

   ```bash
   git clone https://github.com/anomalyco/opencode.git
   cd opencode
   ```

2. **安装依赖**

   ```bash
   bun install
   ```

3. **运行开发服务器**

   ```bash
   # 在当前目录运行 opencode（默认）
   bun dev

   # 在特定目录运行
   bun dev /path/to/your/project

   # 在 opencode 仓库本身运行
   bun dev .
   ```

### 其他开发命令

#### 运行 Web 应用

```bash
bun run --cwd packages/app dev
```

#### 运行桌面应用

```bash
bun run --cwd packages/desktop tauri dev
```

#### 构建 standalone 可执行文件

```bash
./packages/opencode/script/build.ts --single
```

#### 运行构建的版本

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

#### 类型检查

```bash
bun turbo typecheck
# 或
bun run --cwd packages/opencode typecheck
```

---

## 项目结构

### Monorepo 包结构

```
opencode/
├── packages/
│   ├── opencode/           # 核心包：服务器、CLI、工具、代理
│   │   ├── src/
│   │   │   ├── cli/        # CLI 命令实现
│   │   │   ├── server/     # Hono 服务器和路由
│   │   │   ├── agent/      # 代理系统
│   │   │   ├── tool/       # 工具定义
│   │   │   ├── mcp/        # MCP 集成
│   │   │   ├── lsp/        # LSP 客户端
│   │   │   ├── session/    # 会话管理
│   │   │   ├── permission/ # 权限系统
│   │   │   ├── provider/   # AI 提供商
│   │   │   ├── storage/    # 存储层
│   │   │   ├── config/     # 配置管理
│   │   │   ├── auth/       # 身份认证
│   │   │   ├── file/       # 文件操作
│   │   │   ├── shell/      # Shell 交互
│   │   │   └── util/       # 工具函数
│   │   └── bin/
│   │       └── opencode     # CLI 入口
│   ├── app/               # Web 应用（SolidJS + Vite）
│   │   ├── src/           # 源代码
│   │   ├── public/        # 静态资源
│   │   └── e2e/          # E2E 测试（Playwright）
│   ├── desktop/           # 桌面应用（Tauri）
│   ├── console/           # 控制台相关
│   ├── ui/               # 共享 UI 组件
│   ├── plugin/            # 插件系统
│   ├── sdk/              # TypeScript SDK
│   │   └── js/           # JavaScript SDK
│   ├── util/             # 共享工具函数
│   ├── web/              # Web 营销站点
│   ├── identity/          # 身份服务
│   ├── enterprise/        # 企业版功能
│   ├── extensions/        # 扩展
│   ├── function/          # Serverless 函数
│   ├── script/            # 构建和部署脚本
│   └── slack/            # Slack 集成
├── docs/                 # 文档
├── infra/               # 基础设施配置
├── github/              # GitHub Actions 配置
├── script/             # 根级别脚本
├── specs/              # 规范文档
├── themes/             # 主题配置
├── package.json        # 根 package.json（工作区配置）
├── turbo.json         # Turborepo 配置
├── tsconfig.json     # TypeScript 配置
├── bunfig.toml      # Bun 配置
└── flake.nix        # Nix 配置（可选）
```

### 核心包详解

#### `packages/opencode/`

这是 OpenCode 的核心包，包含：

**CLI (`src/cli/`)**

- `index.ts`：CLI 入口，使用 Yargs 解析命令
- `cmd/`：所有 CLI 命令实现
  - `run.ts`：运行 opencode（主要命令）
  - `serve.ts`：启动 headless 服务器
  - `auth.ts`：认证管理
  - `agent.ts`：代理管理
  - `mcp.ts`： MCP 管理
  - `web.ts`：Web 界面
  - `session.ts`：会话操作
  - `tui/`：TUI 相关命令和组件

**Server (`src/server/`)**

- `server.ts`：Hono 服务器主文件
- `routes/`：API 路由
  - `session.ts`：会话相关端点
  - `project.ts`：项目相关端点
  - `tui.ts`：TUI 专用端点
  - `mcp.ts`：MCP 端点
  - `file.ts`：文件操作端点
  - `config.ts`：配置端点
  - `provider.ts`：提供商端点

**Agent (`src/agent/`)**

- `agent.ts`：代理定义和管理
- `prompt/`：系统提示词模板

**Tool (`src/tool/`)**

- `tool.ts`：工具接口定义
- 各种工具实现（bash, edit, read, write, glob, grep 等）

**MCP (`src/mcp/`)**

- MCP 服务器连接和管理
- 工具注册

**LSP (`src/lsp/`)**

- LSP 客户端实现
- 诊断、补全、定义查找等功能

**Provider (`src/provider/`)**

- AI 提供商抽象和实现
- 支持的提供商：Anthropic, OpenAI, Google, Azure 等

---

## 核心技术栈

### 运行时和构建工具

| 技术           | 版本       | 用途                                |
| -------------- | ---------- | ----------------------------------- |
| **Bun**        | 1.3+       | JavaScript 运行时、包管理器、打包器 |
| **TypeScript** | 5.8.2      | 类型系统                            |
| **Turborepo**  | 2.5.6      | Monorepo 构建工具                   |
| **Vite**       | 7.1.4      | Web 应用打包器（app/）              |
| **esbuild**    | 内置在 Bun | 快速打包（opencode/）               |

### 服务器和 API

| 技术             | 版本   | 用途                 |
| ---------------- | ------ | -------------------- |
| **Hono**         | 4.10.7 | HTTP 服务器框架      |
| **hono-openapi** | 1.1.2  | OpenAPI 规范生成     |
| **zod**          | 4.1.8  | 运行时验证和类型推断 |
| **ulid**         | 3.0.1  | 唯一 ID 生成         |

### AI SDK

| 技术                   | 用途                  |
| ---------------------- | --------------------- |
| **ai** (Vercel AI SDK) | 统一的 AI 提供商接口  |
| **@ai-sdk/anthropic**  | Anthropic Claude 集成 |
| **@ai-sdk/openai**     | OpenAI GPT 集成       |
| **@ai-sdk/google**     | Google Gemini 集成    |
| **@ai-sdk/azure**      | Azure OpenAI 集成     |
| **@ai-sdk/groq**       | Groq 集成             |
| **@ai-sdk/mistral**    | Mistral 集成          |
| **@ai-sdk/togetherai** | Together AI 集成      |

### 前端

| 技术                   | 版本    | 用途                         |
| ---------------------- | ------- | ---------------------------- |
| **SolidJS**            | 1.9.10  | 响应式 UI 框架               |
| **@opentui/solid**     | 0.1.74  | 终端 UI 组件库               |
| **@opentui/core**      | 0.1.74  | OpenTUI 核心                 |
| **Tailwind CSS**       | 4.1.11  | 样式系统                     |
| **Vite**               | 7.1.4   | 开发服务器和打包             |
| **@kobalte/core**      | 0.13.11 | 无障碍 UI 组件               |
| **@solid-primitives/** | 多个    | SolidJS 原语（存储、事件等） |

### 桌面应用

| 技术      | 用途               |
| --------- | ------------------ |
| **Tauri** | 跨平台桌面应用框架 |
| **Rust**  | Tauri 后端语言     |

### 工具和库

| 技术                          | 版本   | 用途               |
| ----------------------------- | ------ | ------------------ |
| **remeda**                    | 2.26.0 | 函数式工具库       |
| **fuzzysort**                 | 3.1.0  | 模糊搜索           |
| **marked**                    | 17.0.1 | Markdown 解析      |
| **shiki**                     | 3.20.0 | 代码高亮           |
| **diff**                      | 8.0.2  | 文本差异比较       |
| **luxon**                     | 3.6.1  | 日期时间处理       |
| **@parcel/watcher**           | 2.5.1  | 文件系统监听       |
| **tree-sitter**               | -      | 语法树解析         |
| **vscode-jsonrpc**            | 8.2.1  | JSON-RPC 协议      |
| **@modelcontextprotocol/sdk** | 1.25.2 | MCP 协议实现       |
| **yargs**                     | 18.0.0 | CLI 参数解析       |
| **zod-to-json-schema**        | 3.24.5 | Zod 转 JSON Schema |

### 测试

| 技术                 | 版本   | 用途     |
| -------------------- | ------ | -------- |
| **Bun Test**         | 内置   | 单元测试 |
| **@playwright/test** | 1.51.0 | E2E 测试 |

### 开发工具

| 技术         | 用途    |
| ------------ | ------- | -------------- |
| **Prettier** | 3.6.2   | 代码格式化     |
| **Husky**    | 9.1.7   | Git hooks      |
| **sst**      | 3.17.23 | 基础设施即代码 |

---

## 核心概念

### 1. Agent（代理）

代理是 OpenCode 的核心概念，代表不同能力和权限的 AI 助手。

#### 代理类型

- **Primary Agents（主要代理）**：
  - 用户可以直接切换使用
  - 通过 `Tab` 键在 TUI 中切换
  - 示例：`build`、`plan`

- **Subagents（子代理）**：
  - 不能直接切换使用
  - 由其他代理内部调用
  - 示例：`general`、`explore`

- **All（通用代理）**：
  - 可以作为主要代理或子代理使用

#### 内置代理

| 代理      | 类型     | 描述                       | 默认 |
| --------- | -------- | -------------------------- | ---- |
| `build`   | primary  | 默认开发代理，完整访问权限 | ✅   |
| `plan`    | primary  | 只读代理，用于分析和规划   | ❌   |
| `general` | subagent | 通用代理，用于复杂任务     | -    |
| `explore` | subagent | 代码探索专家               | -    |

#### 代理配置结构

```typescript
interface AgentInfo {
  name: string // 代理名称
  description?: string // 描述
  mode: "subagent" | "primary" | "all" // 类型
  native?: boolean // 是否内置
  hidden?: boolean // 是否隐藏
  permission: Ruleset // 权限规则
  model?: {
    // 模型配置
    modelID: string
    providerID: string
  }
  prompt?: string // 系统提示词
  options: object // 其他选项
  temperature?: number // 温度参数
  topP?: number // Top P 参数
  steps?: number // 最大步骤数
}
```

#### 自定义代理

用户可以在配置文件中定义自定义代理：

```typescript
{
  "agent": {
    "my-agent": {
      "mode": "primary",
      "description": "My custom agent",
      "model": "anthropic/claude-sonnet-4-20250514",
      "permission": {
        "bash": "ask",
        "edit": "ask"
      }
    }
  }
}
```

### 2. Tool（工具）

工具是代理可以执行的操作。每个工具都有：

#### 工具接口

```typescript
interface ToolInfo<Parameters extends ZodType, Metadata> {
  id: string
  init: (ctx?: InitContext) => Promise<{
    description: string
    parameters: Parameters // Zod schema
    execute(
      args: z.infer<Parameters>,
      ctx: Context,
    ): Promise<{
      title: string
      metadata: Metadata
      output: string
      attachments?: FilePart[]
    }>
    formatValidationError?(error: ZodError): string
  }>
}
```

#### 工具定义示例

```typescript
import { Tool } from "./tool"
import z from "zod"

export const ReadTool = Tool.define("read", {
  description: "Read a file",
  parameters: z.object({
    filePath: z.string().describe("File path"),
  }),
  async execute(args, ctx) {
    const content = await Bun.file(args.filePath).text()
    return {
      title: `Read ${args.filePath}`,
      output: content,
      metadata: {},
    }
  },
})
```

#### 核心工具

| 工具                  | 功能                       |
| --------------------- | -------------------------- |
| `bash`                | 执行 shell 命令            |
| `edit`                | 编辑文件（AST 或文本替换） |
| `write`               | 写入文件                   |
| `read`                | 读取文件                   |
| `glob`                | 文件模式匹配               |
| `grep`                | 内容搜索                   |
| `lsp_goto_definition` | 跳转到定义                 |
| `lsp_find_references` | 查找引用                   |
| `webfetch`            | 获取网页内容               |
| `websearch`           | Web 搜索                   |
| `todowrite`           | 创建待办事项               |
| `todoread`            | 读取待办事项               |

### 3. Session（会话）

会话是用户与代理交互的上下文，包含：

- 消息历史（用户和代理消息）
- 元数据（标题、创建时间、父会话 ID）
- 权限规则
- 配置（使用的代理、模型）

#### 会话生命周期

```
1. 创建会话 → session.create()
2. 发送提示 → session.prompt()
3. 处理事件 → event.subscribe()
4. 工具调用 → Tool.execute()
5. 子代理调用 → Agent.subagent()
6. 完成/空闲 → session.idle
7. 持久化 → Storage.save()
```

### 4. Permission（权限）

OpenCode 使用细粒度的权限系统来控制代理可以执行的操作。

#### 权限动作

- `allow`：允许
- `deny`：拒绝
- `ask`：请求用户确认

#### 权限模式

```typescript
{
  "bash": "ask",              // 执行 bash 命令需要确认
  "edit": "allow",           // 允许编辑所有文件
  "read": {
    "*": "allow",            // 允许读取所有文件
    "*.env": "ask",         // 读取 .env 文件需要确认
  },
  "external_directory": {
    "/usr": "deny",         // 拒绝访问 /usr
    "~/Downloads": "allow",   // 允许访问 Downloads
  }
}
```

### 5. MCP（Model Context Protocol）

MCP 是一种协议，允许 OpenCode 连接到外部服务器，使用额外的工具和资源。

#### MCP 组件

- **Servers**：提供工具和资源的外部进程
- **Clients**：连接到 MCP 服务器的 OpenCode
- **Tools**：通过 MCP 暴露的工具
- **Resources**：通过 MCP 暴露的文件或数据
- **Prompts**：可复用的提示词模板

#### 使用 MCP

```bash
# 列出可用的 MCP 服务器
opencode mcp list

# 添加 MCP 服务器
opencode mcp add <name> <command>

# 启动 MCP 服务器
opencode mcp start <name>
```

### 6. LSP（Language Server Protocol）

OpenCode 内置 LSP 支持，提供：

- **代码补全**
- **定义跳转**（`lsp_goto_definition`）
- **引用查找**（`lsp_find_references`）
- **符号搜索**（`lsp_symbols`）
- **诊断信息**（`lsp_diagnostics`）
- **代码重命名**（`lsp_rename`）

#### 支持的语言

- TypeScript/JavaScript
- Python
- Go
- Rust
- C/C++
- Java
- 等

---

## 开发工作流

### 1. 本地开发流程

```bash
# 1. 克隆并安装依赖
git clone https://github.com/anomalyco/opencode.git
cd opencode
bun install

# 2. 开发 TUI
bun dev

# 3. 或开发 Web 界面（在另一个终端）
bun run --cwd packages/app dev

# 4. 或开发桌面应用
bun run --cwd packages/desktop tauri dev
```

### 2. 修改 Server API

如果你修改了服务器 API（`packages/opencode/src/server/server.ts`），需要重新生成 SDK：

```bash
./script/generate.ts
```

这将更新 `packages/sdk/js/` 中的 TypeScript SDK。

### 3. 类型检查

```bash
# 检查整个 monorepo
bun turbo typecheck

# 检查特定包
bun run --cwd packages/opencode typecheck
bun run --cwd packages/app typecheck
```

### 4. 运行测试

```bash
# 单元测试
bun test

# E2E 测试（Web 应用）
bun run --cwd packages/app test:e2e:local
```

### 5. 构建生产版本

```bash
# 构建 opencode 核心
bun run --cwd packages/opencode build

# 构建 standalone 可执行文件
./packages/opencode/script/build.ts --single

# 构建 Web 应用
bun run --cwd packages/app build

# 构建桌面应用
bun run --cwd packages/desktop tauri build
```

---

## 调试技巧

### 1. Bun Inspector

使用 Bun 的内置调试器：

```bash
# 启动带 inspect 的进程
bun run --inspect=ws://localhost:6499 dev

# 在另一个终端，在 VSCode 中附加
# 使用 .vscode/launch.example.json 配置
```

### 2. 调试服务器

```bash
# 在 worker 中运行服务器（默认方式）
bun dev spawn

# 或分离运行：
# 终端 1：启动服务器
bun run --inspect=ws://localhost:6499 ./src/index.ts serve --port 4096

# 终端 2：附加 TUI
opencode attach http://localhost:4096
```

### 3. 调试 TUI

```bash
bun run --inspect=ws://localhost:6499/ --conditions=browser ./src/index.ts
```

### 4. 日志配置

```bash
# 打印日志到 stderr
opencode --print-logs

# 设置日志级别
opencode --log-level DEBUG
```

环境变量：

```bash
export BUN_OPTIONS=--inspect=ws://localhost:6499/
```

### 5. 常见调试场景

#### 调试工具执行

在 `Tool.define` 的 `execute` 方法中添加日志：

```typescript
export const MyTool = Tool.define("my-tool", {
  async execute(args, ctx) {
    console.log("Tool called with:", args)
    // ...
  },
})
```

#### 调试代理行为

在代理的 `init` 中添加日志：

```typescript
const agent: Agent.Info = {
  name: "my-agent",
  async init(ctx) {
    console.log("Agent initialized:", ctx.agent)
    // ...
  },
}
```

#### 调试服务器路由

在 Hono 中间件中添加日志：

```typescript
app.use((c, next) => {
  console.log(`${c.req.method} ${c.req.path}`)
  return next()
})
```

---

## 常见开发任务

### 任务 1：添加新的 CLI 命令

1. 在 `packages/opencode/src/cli/cmd/` 创建新文件：

```typescript
// packages/opencode/src/cli/cmd/mycommand.ts
import { cmd } from "./cmd"
import yargs from "yargs"

export const MyCommand = cmd({
  command: "mycommand [input]",
  describe: "My custom command",
  builder: (yargs) => {
    return yargs
      .positional("input", {
        describe: "Input value",
        type: "string",
      })
      .option("flag", {
        describe: "A flag",
        type: "boolean",
      })
  },
  handler: async (args) => {
    console.log("My command:", args)
  },
})
```

2. 在 `packages/opencode/src/index.ts` 中注册：

```typescript
import { MyCommand } from "./cli/cmd/mycommand"

// ...

cli.command(MyCommand)
```

### 任务 2：添加新工具

```typescript
// packages/opencode/src/tool/my-tool.ts
import { Tool } from "./tool"
import z from "zod"

export const MyTool = Tool.define("my-tool", {
  description: "My custom tool",
  parameters: z.object({
    input: z.string().describe("Input string"),
  }),
  async execute(args, ctx) {
    // 工具逻辑
    const result = doSomething(args.input)

    return {
      title: "My Tool Result",
      output: result,
      metadata: {},
    }
  },
})
```

然后在 `packages/opencode/src/tool/index.ts` 中导出。

### 任务 3：添加新的 AI 提供商

1. 在 `packages/opencode/src/provider/` 创建新的提供商：

```typescript
// packages/opencode/src/provider/my-provider.ts
import { Provider } from "./provider"

export const MyProvider = {
  name: "my-provider",
  async getModel(modelID: string) {
    return {
      id: modelID,
      name: "My Model",
      provider: "my-provider",
      // ...
    }
  },
}
```

2. 在 `packages/opencode/src/provider/provider.ts` 中注册。

### 任务 4：创建自定义代理

在用户配置文件中添加：

```json
{
  "agent": {
    "my-agent": {
      "mode": "primary",
      "description": "A specialized agent",
      "model": "anthropic/claude-sonnet-4-20250514",
      "permission": {
        "*": "ask"
      },
      "prompt": "You are a helpful assistant."
    }
  }
}
```

### 任务 5：修改 Server API

1. 编辑 `packages/opencode/src/server/server.ts` 或创建新路由文件

2. 添加新路由：

```typescript
app.get("/api/my-endpoint", async (c) => {
  return c.json({ message: "Hello" })
})
```

3. 重新生成 SDK：

```bash
./script/generate.ts
```

### 任务 6：修改 TUI 组件

1. TUI 组件位于 `packages/opencode/src/cli/cmd/tui/`

2. 使用 SolidJS + OpenTUI 组件：

```tsx
import { createSignal } from "solid-js"

export function MyComponent() {
  const [value, setValue] = createSignal("")

  return (
    <div>
      <input value={value()} onInput={(e) => setValue(e.target.value)} />
    </div>
  )
}
```

### 任务 7：添加 MCP 集成

1. 在 `packages/opencode/src/mcp/` 中添加 MCP 服务器配置

2. 注册 MCP 工具到工具系统

---

## 贡献指南

### 贡献类型

OpenCode 欢迎以下类型的贡献：

- ✅ Bug 修复
- ✅ 额外的 LSP/格式化器支持
- ✅ LLM 性能改进
- ✅ 新提供商支持
- ✅ 环境特定问题的修复
- ✅ 缺失的标准行为
- ✅ 文档改进

⚠️ **注意**：任何 UI 或核心产品功能都必须在实施前与核心团队进行设计审查。

### Issue First 策略

**所有 PR 必须引用现有的 Issue。**

1. 在实施前打开 Issue 描述问题或功能
2. 等待维护者批准
3. 实施 PR，在描述中引用 Issue（`Fixes #123`）

### PR 要求

1. **小而专注**：保持 PR 小范围
2. **解释清楚**：说明问题以及为什么你的更改能修复它
3. **检查现有功能**：确保新功能不存在
4. **遵循风格指南**：参考 [STYLE_GUIDE.md](../STYLE_GUIDE.md)

### UI 变更

如果 PR 包含 UI 变更，请提供**截图或视频**展示前后对比。

### 逻辑变更

对于非 UI 变更（bug 修复、新功能、重构），说明**如何验证它工作**：

- 你测试了什么？
- 审查者如何重现/确认修复？

### PR 标题

遵循 conventional commit 标准：

- `feat:` 新功能
- `fix:` bug 修复
- `docs:` 文档变更
- `chore:` 维护任务
- `refactor:` 代码重构
- `test:` 添加或更新测试

可选范围：

- `feat(opencode):` opencode 包中的功能
- `fix(app):` app 包中的 bug 修复
- `chore(server):` 服务器维护

### 代码风格偏好

- **函数**：将逻辑保持在一个函数中，除非拆分增加明显的复用或组合价值
- **解构**：避免不必要的解构
- **控制流**：避免 `else` 语句
- **错误处理**：尽可能使用 `.catch()` 而不是 `try`/`catch`
- **类型**：使用精确的类型，避免 `any`
- **变量**：坚持不可变模式，避免 `let`
- **命名**：选择简洁的单单词标识符
- **运行时 API**：适合时使用 Bun 助手如 `Bun.file()`

### 测试要求

```bash
# 运行测试
bun test

# 类型检查
bun turbo typecheck
```

---

## 下一步

现在你已经了解了 OpenCode 的基本架构和开发流程，可以：

1. 🔍 深入阅读特定模块的源代码
2. 📚 查阅其他详细文档（见 [文档索引](./INDEX.md)）
3. 🛠️ 尝试添加简单功能或修复 bug
4. 💬 加入社区：[Discord](https://opencode.ai/discord)
5. 🐛 查看 [good first issue](https://github.com/anomalyco/opencode/issues?q=is%3Aissue+state%3Aopen+label%3A%22good+first+issue%22)

## 额外资源

- [OpenCode 官方文档](https://opencode.ai/docs)
- [OpenCode GitHub](https://github.com/anomalyco/opencode)
- [OpenTUI 文档](https://github.com/sst/opentui)
- [SolidJS 文档](https://solidjs.com)
- [Hono 文档](https://hono.dev)
- [Vercel AI SDK](https://sdk.vercel.ai/docs/ai-sdk-core/overview)
- [Model Context Protocol](https://modelcontextprotocol.io)

---

_文档版本：1.0.0_
_最后更新：2026-01-21_
