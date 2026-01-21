# 从 Claude Code 迁移

## 目录

1. [概述](#概述)
2. [功能对比](#功能对比)
3. [架构差异](#架构差异)
4. [安装与设置](#安装与设置)
5. [配置迁移](#配置迁移)
6. [工作流调整](#工作流调整)
7. [迁移检查清单](#迁移检查清单)
8. [常见问题解答](#常见问题解答)
9. [最佳实践](#最佳实践)

---

## 概述

本指南帮助您从 Claude Code 迁移到 OpenCode。OpenCode 是 Claude Code 的开源替代品，提供了相似的功能，同时具有以下优势：

- ✅ **100% 开源**：完全透明，可审计
- ✅ **提供商无关**：支持多个 AI 提供商（Claude、OpenAI、Google 等）
- ✅ **原生 LSP 支持**：内置语言服务协议支持
- ✅ **专注 TUI**：针对终端用户优化的界面
- ✅ **客户端-服务器架构**：支持远程访问和多客户端

### 迁移动机

选择从 Claude Code 迁移到 OpenCode 的原因可能包括：

1. **开源需求**：需要查看源代码或自定义
2. **提供商灵活性**：希望使用不同的 AI 模型
3. **成本控制**：寻求更具成本效益的解决方案
4. **团队协作**：需要多人协作或远程访问
5. **本地部署**：需要本地运行或私有部署
6. **学习曲线**：已经熟悉 Claude Code 工作流

### 迁移难度

- **学习曲线**: 低（相似的工作流）
- **配置迁移**: 中等（需要手动调整）
- **数据迁移**: 不适用（会话历史不互通）
- **总体评估**: 中等（1-2 天适应期）

---

## 功能对比

### 核心功能

| 功能            | Claude Code     | OpenCode                                                        | 说明                        |
| --------------- | --------------- | --------------------------------------------------------------- | --------------------------- |
| **AI 模型支持** | Claude 系列模型 | Anthropic, OpenAI, Google, Azure, Mistral, Groq, Together AI 等 | OpenCode 支持更多提供商     |
| **代码编辑**    | ✅ 支持         | ✅ 支持                                                         | 功能相似                    |
| **文件操作**    | ✅ 支持         | ✅ 支持                                                         | 功能相似                    |
| **终端命令**    | ✅ 支持         | ✅ 支持                                                         | 功能相似                    |
| **代码搜索**    | ✅ 支持         | ✅ 支持                                                         | OpenCode 使用 glob + grep   |
| **Web 搜索**    | ✅ 支持         | ✅ 支持                                                         | 通过 Exa AI 实现            |
| **LSP 支持**    | ❌ 不原生支持   | ✅ 内置支持                                                     | OpenCode 原生集成 LSP       |
| **多代理系统**  | ❌ 单一代理     | ✅ 多代理（build, plan, explore）                               | OpenCode 有更灵活的代理系统 |
| **权限控制**    | 基础权限        | 细粒度权限（allow/deny/ask）                                    | OpenCode 权限系统更强大     |
| **TUI 界面**    | ✅ 支持         | ✅ 支持（基于 OpenTUI）                                         | 体验相似                    |
| **Web 界面**    | ❌ 不支持       | ✅ 支持（基于 SolidJS）                                         | OpenCode 额外提供 Web UI    |
| **桌面应用**    | ❌ 不支持       | ✅ 支持（基于 Tauri）                                           | OpenCode 额外提供桌面应用   |
| **远程访问**    | ❌ 不支持       | ✅ 支持（客户端-服务器架构）                                    | OpenCode 可远程连接         |
| **会话历史**    | ✅ 支持         | ✅ 支持                                                         | 功能相似                    |
| **后台任务**    | ✅ 支持         | ✅ 支持                                                         | 功能相似                    |
| **会话分支**    | ❌ 不支持       | ✅ 支持                                                         | OpenCode 支持会话分支       |
| **MCP 集成**    | ✅ 支持         | ✅ 支持                                                         | 完全兼容 MCP 协议           |
| **插件系统**    | 有限支持        | ✅ 完整支持                                                     | OpenCode 有更强大的插件生态 |
| **自定义技能**  | ❌ 不支持       | ✅ 支持                                                         | OpenCode 支持自定义技能     |
| **开源**        | ❌ 闭源         | ✅ 开源                                                         | OpenCode 完全开源           |

### 工具对比

#### 文件操作

| 工具     | Claude Code    | OpenCode        | 功能                       |
| -------- | -------------- | --------------- | -------------------------- |
| 读取文件 | `read_file`    | `read`          | 读取文件内容               |
| 写入文件 | `write_file`   | `write`         | 写入/创建文件              |
| 编辑文件 | `edit_file`    | `edit`          | 编辑文件（文本替换或 AST） |
| 搜索文件 | `search_files` | `glob` + `grep` | 文件名和内容搜索           |

#### Shell 操作

| 工具       | Claude Code              | OpenCode          | 功能            |
| ---------- | ------------------------ | ----------------- | --------------- |
| 执行命令   | `run_command`            | `bash`            | 执行 shell 命令 |
| 交互式终端 | `run_command` + 交互模式 | `bash` + PTY 支持 | 交互式 shell    |

#### 代码智能

| 工具       | Claude Code | OpenCode              | 功能                |
| ---------- | ----------- | --------------------- | ------------------- |
| 定义跳转   | 有限支持    | `lsp_goto_definition` | 跳转到符号定义      |
| 引用查找   | 有限支持    | `lsp_find_references` | 查找所有引用        |
| 符号搜索   | 有限支持    | `lsp_symbols`         | 搜索文件/工作区符号 |
| 诊断信息   | 有限支持    | `lsp_diagnostics`     | 获取错误、警告      |
| 代码重命名 | 不支持      | `lsp_rename`          | 重命名符号          |

#### Web 操作

| 工具     | Claude Code | OpenCode             | 功能         |
| -------- | ----------- | -------------------- | ------------ |
| 获取网页 | 不支持      | `webfetch`           | 获取网页内容 |
| Web 搜索 | 内置搜索    | `websearch` + Exa AI | 搜索网络内容 |

### 工作流对比

#### Claude Code 工作流

```
用户输入
  ↓
Claude 分析
  ↓
选择工具（read_file, write_file, run_command 等）
  ↓
执行工具
  ↓
返回结果
  ↓
继续处理
  ↓
完成
```

#### OpenCode 工作流

```
用户输入
  ↓
选择代理（build/plan/explore）
  ↓
代理分析
  ↓
权限检查（allow/deny/ask）
  ↓
选择工具（read, write, bash, lsp_* 等）
  ↓
执行工具
  ↓
返回结果 + SSE 事件流
  ↓
继续处理
  ↓
完成
```

**关键差异**：

- OpenCode 有权限检查步骤
- OpenCode 使用 SSE 实时推送事件
- OpenCode 支持多代理协作

---

## 架构差异

### Claude Code 架构

```
┌─────────────────────────────┐
│     Claude Code 客户端     │
│   (单一可执行文件)        │
└─────────────┬─────────────┘
              │
              ▼
┌─────────────────────────────┐
│   Anthropic Claude API     │
│   (REST API)             │
└─────────────────────────────┘
```

**特点**：

- 单体架构
- 直接连接 Anthropic API
- 无服务器组件
- 无客户端-服务器分离

### OpenCode 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端层                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │   TUI    │  │   Web    │  │ Desktop  │            │
│  │(OpenTUI) │  │(SolidJS) │  │ (Tauri)  │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
└───────┼─────────────┼─────────────┼───────────────────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
        ┌─────────────┴─────────────┐
        │      HTTP/WebSocket      │
        │    @opencode-ai/sdk     │
        └─────────────┬─────────────┘
                      │
        ┌─────────────┴──────────────────────────────────┐
        │      OpenCode Server (Hono HTTP Server)      │
        │  ┌────────────────────────────────────────┐ │
        │  │   REST API + SSE (streamSSE)       │ │
        │  │  /session, /config, /tool, /mcp   │ │
        │  └────────────────────────────────────────┘ │
        └─────────────┬──────────────────────────────────┘
                      │
        ┌─────────────┴──────────────────────────────────┐
        │              核心子系统                          │
        │  Agent System │ Tool Layer │ Permission │     │
        │   LSP Layer  │   Session   │   Storage   │     │
        │   MCP Layer  │  Provider   │    Auth     │     │
        └─────────────┴──────────────────────────────────┘
                      │
        ┌─────────────┴──────────────────────────────────┐
        │           外部服务与依赖                      │
        │  AI Providers  │ MCP Server │ File System  │    │
        │ (Claude/GPT...)│ (外部工具)    │ (文件系统)    │    │
        └─────────────────────────────────────────────────┘
```

**特点**：

- 客户端-服务器分离
- 多客户端支持
- 实时事件流（SSE）
- 模块化子系统
- 可扩展架构

### 架构影响

| 方面         | Claude Code | OpenCode        | 影响                    |
| ------------ | ----------- | --------------- | ----------------------- |
| **启动方式** | 单命令启动  | 服务器 + 客户端 | OpenCode 需要启动服务器 |
| **远程访问** | 不支持      | 支持            | OpenCode 可远程连接     |
| **多会话**   | 支持        | 支持            | 功能相似                |
| **并发性**   | 单会话      | 多会话并发      | OpenCode 支持多客户端   |
| **资源占用** | 中等        | 较高（服务器）  | OpenCode 需要更多资源   |

---

## 安装与设置

### 卸载 Claude Code

在安装 OpenCode 之前，建议先卸载 Claude Code 以避免冲突：

```bash
# macOS/Linux
rm -rf ~/.claude-code
rm -f /usr/local/bin/claude-code  # 或安装位置

# Windows
rmdir %APPDATA%\claude-code
# 从 PATH 中移除
```

### 安装 OpenCode

#### 方法 1：使用安装脚本（推荐）

```bash
curl -fsSL https://opencode.ai/install | bash
```

#### 方法 2：使用包管理器

```bash
# npm
npm install -g opencode-ai

# Homebrew（macOS）
brew install anomalyco/tap/opencode

# Scoop（Windows）
scoop install opencode

# Bun
bun install -g opencode-ai
```

#### 方法 3：下载预编译二进制

从 [GitHub Releases](https://github.com/anomalyco/opencode/releases) 下载适合您平台的二进制文件。

### 初始设置

#### 1. 配置 AI 提供商

如果您想继续使用 Claude：

```bash
# 设置 Anthropic API Key
opencode provider add anthropic --key your_api_key_here

# 设置默认模型
opencode config set model anthropic/claude-sonnet-4-20250514
```

如果您想使用其他提供商（如 OpenAI）：

```bash
# 添加 OpenAI 提供商
opencode provider add openai --key your_openai_key_here

# 设置默认模型
opencode config set model openai/gpt-4o
```

#### 2. 验证安装

```bash
# 检查版本
opencode --version

# 查看配置
opencode config list

# 测试运行
opencode
```

#### 3. 选择界面

OpenCode 提供三种界面：

```bash
# TUI（默认）
opencode

# Web 界面
opencode web

# 桌面应用
# 从 opencode.ai/download 下载并安装
```

---

## 配置迁移

### API 配置迁移

#### Claude Code 配置

Claude Code 通常通过环境变量或配置文件设置 API：

```bash
# Claude Code 环境变量
export ANTHROPIC_API_KEY="sk-ant-..."
```

#### OpenCode 配置

OpenCode 使用不同的配置系统：

```bash
# 添加 Anthropic 提供商
opencode provider add anthropic --key sk-ant-...

# 验证配置
opencode provider list

# 设置为默认
opencode config set model anthropic/claude-sonnet-4-20250514
```

**迁移步骤**：

1. **获取 API Key**:

   ```bash
   # 从 Claude Code 配置中提取
   echo $ANTHROPIC_API_KEY
   ```

2. **配置 OpenCode**:

   ```bash
   # 使用相同的 API Key
   opencode provider add anthropic --key sk-ant-...
   ```

3. **验证连接**:
   ```bash
   # 发送测试请求
   opencode test --provider anthropic
   ```

### 模型配置迁移

#### Claude Code 默认模型

Claude Code 通常使用 `claude-sonnet-4-20250514` 或 `claude-opus-4-20250514`。

#### OpenCode 模型映射

| Claude Code 模型           | OpenCode 模型                        | 提供商    |
| -------------------------- | ------------------------------------ | --------- |
| `claude-sonnet-4-20250514` | `anthropic/claude-sonnet-4-20250514` | Anthropic |
| `claude-opus-4-20250514`   | `anthropic/claude-opus-4-20250514`   | Anthropic |
| `claude-haiku-4-20250514`  | `anthropic/claude-haiku-4-20250514`  | Anthropic |

**迁移配置**：

```bash
# 设置 Claude Sonnet 4
opencode config set model anthropic/claude-sonnet-4-20250514

# 或 Claude Opus 4
opencode config set model anthropic/claude-opus-4-20250514
```

### 权限配置迁移

#### Claude Code 权限

Claude Code 有基础的权限控制，但没有细粒度配置。

#### OpenCode 权限系统

OpenCode 提供强大的细粒度权限系统：

```bash
# 查看当前权限配置
opencode config get permission

# 设置权限规则
opencode config set permission.bash ask
opencode config set permission.edit allow
opencode config set permission.read allow

# 更复杂的权限配置
cat > /tmp/permission.json << EOF
{
  "bash": "ask",
  "edit": "allow",
  "read": {
    "*": "allow",
    "*.env": "ask"
  },
  "external_directory": {
    "/usr": "deny",
    "~/Downloads": "allow"
  }
}
EOF

opencode config import permission /tmp/permission.json
```

**推荐初始配置**（类似 Claude Code 默认行为）：

```json
{
  "bash": "allow",
  "edit": "allow",
  "read": "allow",
  "write": "allow",
  "*.env": "ask"
}
```

### 代理配置迁移

OpenCode 的代理系统比 Claude Code 更灵活：

```bash
# 查看内置代理
opencode agent list

# 创建自定义代理（类似 Claude Code 行为）
opencode agent add claude-like \
  --mode primary \
  --description "Similar to Claude Code" \
  --model anthropic/claude-sonnet-4-20250514 \
  --permission '{"*": "allow"}'
```

### MCP 配置迁移

如果您在 Claude Code 中使用了 MCP 服务器，配置可以迁移：

```bash
# 添加 MCP 服务器
opencode mcp add my-server --command node --args my-mcp-server.js

# 启动 MCP 服务器
opencode mcp start my-server

# 列出可用的 MCP 工具
opencode mcp list
```

### 工作目录配置

#### Claude Code

Claude Code 通常在当前目录工作。

#### OpenCode

OpenCode 支持显式指定项目：

```bash
# 在当前目录运行
opencode

# 在特定目录运行
opencode /path/to/project

# 全局项目（所有目录共享）
opencode --global
```

### 会话历史迁移

⚠️ **重要提示**: Claude Code 和 OpenCode 使用不同的会话存储格式，**无法直接迁移**会话历史。

**建议**：

1. **导出重要上下文**:
   - 在 Claude Code 中复制重要对话
   - 保存到文本文件作为参考

2. **重新开始**:
   - 在 OpenCode 中创建新会话
   - 使用之前的重要信息作为上下文

3. **使用会话摘要**:
   - OpenCode 自动为每个会话生成摘要
   - 可以参考旧摘要重新创建类似工作流

### Shell 配置迁移

如果您在 Claude Code 中配置了 shell 别名或环境变量：

```bash
# Claude Code 可能使用的别名
alias cc='claude-code'

# 迁移到 OpenCode
alias oc='opencode'

# 或保留 Claude Code 别名，指向 OpenCode
alias claude-code='opencode'
```

### 快捷键映射

| 操作     | Claude Code | OpenCode TUI |
| -------- | ----------- | ------------ |
| 发送消息 | Enter       | Enter        |
| 新行     | Shift+Enter | Shift+Enter  |
| 切换代理 | 不支持      | Tab          |
| 退出     | Ctrl+C      | Ctrl+C 或 q  |
| 帮助     | 不支持      | ?            |

---

## 工作流调整

### 从单一代理到多代理

#### Claude Code 工作流

Claude Code 使用单一 AI 代理处理所有任务：

```
用户 → Claude AI → 工具 → 结果 → 用户
```

#### OpenCode 多代理工作流

OpenCode 提供多个专业化代理：

```
用户 → 选择代理（build/plan/explore）→ 工具 → 结果 → 用户
```

**代理选择建议**：

| 任务       | 推荐代理 | 原因                 |
| ---------- | -------- | -------------------- |
| 日常开发   | build    | 完整权限，默认选择   |
| 代码分析   | plan     | 只读模式，不会误修改 |
| 代码探索   | explore  | 专注搜索和分析       |
| 多步骤任务 | general  | 内部调用，能力强     |

**切换代理**：

```bash
# 在 TUI 中按 Tab 键切换代理
# 或在配置中设置默认代理
opencode config set agent plan
```

### 适应权限检查

OpenCode 的权限系统会在某些操作前请求确认：

```
[权限请求]
工具: bash
命令: npm install
目录: /path/to/project
操作: [o]nce  [a]lways  [r]eject

请选择: o
```

**处理策略**：

1. **Once**: 仅本次允许
2. **Always**: 永久允许此模式
3. **Reject**: 拒绝操作

**配置自动确认**（类似 Claude Code）：

```bash
# 允许所有 bash 操作
opencode config set permission.bash allow

# 允许所有编辑操作
opencode config set permission.edit allow
```

### 使用 LSP 工具

OpenCode 提供原生 LSP 支持，这是 Claude Code 没有的功能：

```bash
# 在 OpenCode 中询问 AI
"跳转到 read 函数的定义"

# AI 会自动调用 lsp_goto_definition 工具

# 查找所有引用
"查找所有调用 read 函数的地方"

# AI 会自动调用 lsp_find_references 工具
```

**常用 LSP 命令**：

- `lsp_goto_definition`: 跳转到定义
- `lsp_find_references`: 查找引用
- `lsp_symbols`: 搜索符号
- `lsp_diagnostics`: 获取诊断信息
- `lsp_rename`: 重命名符号

### 使用会话分支

OpenCode 支持会话分支，这是 Claude Code 没有的功能：

```bash
# 在 TUI 中
1. 按 ? 查看帮助
2. 按 b 分支当前会话
3. 新分支将继承当前会话的所有消息

# 或使用命令行
opencode session branch <session-id>
```

**使用场景**：

- 尝试不同的实现方案
- A/B 测试不同的代码修改
- 并行处理多个相关任务

### 远程访问工作流

OpenCode 的客户端-服务器架构支持远程访问：

```bash
# 在服务器上启动 OpenCode 服务器
opencode serve --port 4096

# 从远程客户端连接
# TUI
opencode attach http://server-ip:4096

# Web
浏览器访问: http://server-ip:4096
```

**使用场景**：

- 远程开发服务器
- 多设备共享会话
- 团队协作

### 使用 Web 界面

OpenCode 提供 Web 界面，可以替代 TUI：

```bash
# 启动 Web 界面
opencode web

# 浏览器访问
http://localhost:4096
```

**Web 界面优势**：

- 更好的视觉体验
- 支持复制粘贴
- 响应式设计
- 移动端支持

### 使用待办事项管理

OpenCode 内置待办事项管理工具：

```bash
# 在对话中
"创建一个待办列表来跟踪这个任务"

# AI 会自动使用 todowrite 工具

# 查看待办事项
"查看待办列表"

# AI 会自动使用 todoread 工具
```

**工具**：

- `todowrite`: 创建/更新待办事项
- `todoread`: 读取待办事项

### 使用后台任务

OpenCode 支持后台任务，可以并行执行多个操作：

```bash
# 在对话中
"在后台运行这些任务"

# AI 可以调用多个工具并行执行
```

**后台任务管理**：

- 查看后台任务：`opencode task list`
- 取消后台任务：`opencode task cancel <task-id>`
- 查看任务输出：`opencode task output <task-id>`

---

## 迁移检查清单

### 迁移前检查

- [ ] 卸载 Claude Code
- [ ] 备份 Claude Code 配置
- [ ] 导出重要的会话历史
- [ ] 记录常用的 Claude Code 工作流
- [ ] 准备 Anthropic API Key
- [ ] 选择 OpenCode 界面（TUI/Web/Desktop）
- [ ] 阅读本文档完整内容
- [ ] 了解 OpenCode 的代理系统

### 安装检查

- [ ] 下载并安装 OpenCode
- [ ] 验证版本：`opencode --version`
- [ ] 配置 AI 提供商
- [ ] 设置默认模型
- [ ] 配置权限规则
- [ ] 测试基本功能

### 功能测试检查

- [ ] 测试文件读写（read/write）
- [ ] 测试代码编辑（edit）
- [ ] 测试 shell 命令（bash）
- [ ] 测试代码搜索（glob/grep）
- [ ] 测试 LSP 功能（lsp_goto_definition）
- [ ] 测试代理切换（Tab）
- [ ] 测试权限请求机制
- [ ] 测试会话管理（创建/删除/分支）

### 工作流适应检查

- [ ] 熟悉多代理系统（build/plan/explore）
- [ ] 适应权限确认流程
- [ ] 学习使用 LSP 工具
- [ ] 尝试会话分支功能
- [ ] 测试 Web 界面（如果使用）
- [ ] 测试远程访问（如果需要）

### 配置优化检查

- [ ] 调整权限规则以匹配工作习惯
- [ ] 配置自定义代理（如果需要）
- [ ] 设置 MCP 服务器（如果使用）
- [ ] 配置快捷键和别名
- [ ] 调整 AI 模型参数（temperature, max tokens）

---

## 常见问题解答

### Q1: 我能在 OpenCode 中继续使用 Claude API 吗？

**A**: 是的！OpenCode 完全支持 Anthropic Claude API：

```bash
# 添加 Anthropic 提供商
opencode provider add anthropic --key your_api_key_here

# 设置 Claude 模型
opencode config set model anthropic/claude-sonnet-4-20250514

# 开始使用
opencode
```

### Q2: OpenCode 和 Claude Code 的代码质量一样好吗？

**A**:

- **代码理解**: OpenCode 使用相同的 Claude 模型时，代码理解能力相同
- **工具能力**: OpenCode 提供更多工具（LSP, MCP, 插件）
- **工作流**: OpenCode 的多代理和权限系统提供更细粒度的控制

### Q3: 迁移会话历史可能吗？

**A**: 不太可能。Claude Code 和 OpenCode 使用不同的会话存储格式。建议：

1. 导出重要的对话内容
2. 在 OpenCode 中重新开始
3. 利用 OpenCode 的会话摘要功能

### Q4: OpenCode 的 TUI 和 Claude Code 的 TUI 有什么区别？

**A**:
| 特性 | Claude Code | OpenCode |
|------|------------|-----------|
| 框架 | 未知 | OpenTUI |
| 代理切换 | 无 | Tab 键切换 |
| 权限提示 | 基础 | 细粒度控制 |
| 主题支持 | 有限 | 支持多个主题 |
| LSP 集成 | 有限 | 原生支持 |

### Q5: 我需要重新学习所有命令吗？

**A**: 不需要。OpenCode 的工具和 Claude Code 的工具非常相似：

- `read` ≈ `read_file`
- `write` ≈ `write_file`
- `edit` ≈ `edit_file`
- `bash` ≈ `run_command`

主要差异：

- OpenCode 有额外的 LSP 工具
- OpenCode 使用 `glob` 和 `grep` 进行搜索
- OpenCode 有权限确认机制

### Q6: OpenCode 比 Claude Code 更慢吗？

**A**: OpenCode 的性能取决于多个因素：

- **AI 响应速度**: 使用相同模型时相同
- **工具执行**: 本地操作速度相似
- **网络延迟**: 客户端-服务器架构可能增加少量延迟
- **总体评估**: 日常使用差异不明显

### Q7: 我可以在 OpenCode 中使用 OpenAI GPT 吗？

**A**: 是的！OpenCode 支持多个 AI 提供商：

```bash
# 添加 OpenAI
opencode provider add openai --key your_openai_key_here

# 设置 GPT 模型
opencode config set model openai/gpt-4o
```

### Q8: OpenCode 的多代理系统如何工作？

**A**: OpenCode 提供三个主要代理：

- **build**: 完整访问权限，适合日常开发
- **plan**: 只读模式，适合代码分析和规划
- **explore**: 代码探索专家

切换代理：

- TUI 中按 Tab 键
- 或在配置中设置默认代理

### Q9: OpenCode 支持团队协作吗？

**A**:

- **当前**: 支持多客户端连接同一服务器
- **未来**: 计划添加更完善的团队功能
- **建议**: 可以通过远程访问实现基本的团队协作

### Q10: 迁移到 OpenCode 后，我的数据安全吗？

**A**: OpenCode 的安全性：

- ✅ 完全开源，代码可审计
- ✅ 支持 API Key 加密存储
- ✅ 细粒度权限控制
- ✅ 本地数据处理（可选）
- ✅ 不向 OpenCode 官方发送代码（除非使用 Zen 服务）

### Q11: 如何选择合适的 AI 提供商？

**A**:

| 提供商           | 适用场景           |
| ---------------- | ------------------ |
| Anthropic Claude | 代码理解、复杂推理 |
| OpenAI GPT       | 平衡性能和成本     |
| Google Gemini    | 多语言支持         |
| 本地模型         | 隐私敏感场景       |

### Q12: OpenCode 的学习曲线有多陡？

**A**:

- **基础使用**: 1-2 小时
- **高级功能**: 1-2 天
- **完全掌握**: 1-2 周

建议：

1. 先从基础功能开始（read, write, bash）
2. 逐步学习 LSP 工具
3. 探索自定义代理和插件

### Q13: 我可以同时运行 Claude Code 和 OpenCode 吗？

**A**: 技术上可以，但**不推荐**：

- 可能导致配置冲突
- 资源占用增加
- 工作流混乱

建议选择一个并完全迁移。

### Q14: OpenCode 如何处理错误？

**A**: OpenCode 的错误处理：

- ✅ 清晰的错误消息
- ✅ 详细的日志记录
- ✅ 自动重试机制（网络错误）
- ✅ Graceful degradation（部分功能失败时继续工作）

查看日志：

```bash
# 打印日志到 stderr
opencode --print-logs

# 设置日志级别
opencode --log-level DEBUG
```

### Q15: 如何报告问题或请求功能？

**A**:

1. **GitHub Issues**: https://github.com/anomalyco/opencode/issues
2. **Discord 社区**: https://opencode.ai/discord
3. **文档**: https://opencode.ai/docs

报告问题时请提供：

- OpenCode 版本
- 操作系统版本
- 错误信息和日志
- 复现步骤

---

## 最佳实践

### 1. 渐进式迁移

不要一次性完全切换，采用渐进式方法：

**第 1 周**:

- 在小项目中使用 OpenCode
- 熟悉基本工具
- 适应 TUI 界面

**第 2 周**:

- 在中等项目中使用 OpenCode
- 尝试 LSP 工具
- 配置权限规则

**第 3 周**:

- 在所有项目中使用 OpenCode
- 探索高级功能（会话分支、插件）
- 完全卸载 Claude Code

### 2. 保存常用配置

创建配置文件模板以便快速恢复：

```bash
# ~/opencode-config/permission.json
{
  "bash": "allow",
  "edit": "allow",
  "read": "allow",
  "*.env": "ask"
}

# 导入配置
opencode config import permission ~/opencode-config/permission.json
```

### 3. 使用 Shell 别名

提高命令行效率：

```bash
# ~/.bashrc 或 ~/.zshrc

# OpenCode 别名
alias oc='opencode'
alias ocl='opencode --log-level=DEBUG'

# 项目快速启动
alias oc-dev='opencode ~/dev/my-project'
alias oc-work='opencode ~/work/my-project'
```

### 4. 利用会话分支

使用会话分支提高效率：

```
场景：重构代码

1. 主会话：探索代码结构
2. 分支 1：尝试方案 A
3. 分支 2：尝试方案 B
4. 比较两个分支的结果
5. 选择最佳方案并合并到主会话
```

### 5. 配置合适的代理

根据任务选择合适的代理：

```bash
# 日常开发（默认）
opencode config set agent build

# 代码审查（只读）
opencode config set agent plan

# 学习新代码库（探索）
# 使用 explore 代理，在对话中用 @explore
```

### 6. 利用 LSP 提高效率

充分利用 LSP 工具：

```
示例：理解代码库

1. "查看这个函数的定义" → lsp_goto_definition
2. "找到所有调用这个函数的地方" → lsp_find_references
3. "搜索这个文件中的符号" → lsp_symbols
4. "有哪些错误" → lsp_diagnostics
5. "重命名这个函数" → lsp_rename
```

### 7. 定期备份会话数据

保护重要会话：

```bash
#!/bin/bash
# ~/bin/backup-opencode.sh

BACKUP_DIR="$HOME/opencode-backup/$(date +%Y%m%d)"
OPENCODE_DIR="$HOME/.local/share/opencode"

mkdir -p "$BACKUP_DIR"
cp -r "$OPENCODE_DIR" "$BACKUP_DIR/"

# 保留最近 30 天的备份
find "$HOME/opencode-backup" -type d -mtime +30 -exec rm -rf {} \;

echo "Backup completed: $BACKUP_DIR"
```

### 8. 监控性能和资源

确保 OpenCode 高效运行：

```bash
# 检查 OpenCode 进程
ps aux | grep opencode

# 查看内存使用
top | grep opencode

# 检查磁盘使用
du -sh ~/.local/share/opencode

# 清理旧会话
opencode session prune --days 30
```

### 9. 参与社区

获取帮助和分享经验：

- 📖 查看文档: https://opencode.ai/docs
- 💬 加入社区: [Discord](https://opencode.ai/discord)
- 🐛 报告问题: [GitHub Issues](https://github.com/anomalyco/opencode/issues)
- 💡 分享经验: GitHub Discussions

### 10. 保持更新

定期更新 OpenCode 以获得最新功能和修复：

```bash
# 检查更新
opencode upgrade --dry-run

# 升级到最新版本
opencode upgrade

# 或使用包管理器
brew upgrade opencode
npm install -g opencode-ai@latest
```

### 11. 学习高级功能

OpenCode 有许多高级功能值得探索：

- ✅ **插件系统**: 开发自定义插件
- ✅ **自定义技能**: 创建工作流自动化
- ✅ **MCP 集成**: 连接外部服务
- ✅ **远程访问**: 多设备协同
- ✅ **Web 界面**: 可视化交互
- ✅ **桌面应用**: 原生体验

### 12. 性能优化

根据需求调整 OpenCode 配置：

```bash
# 使用更快的模型（简单任务）
opencode config set model anthropic/claude-haiku-4-20250514

# 调整 temperature（创造性 vs 确定性）
opencode config set temperature 0.3

# 设置最大 tokens
opencode config set max-tokens 4096
```

### 13. 多工作区管理

高效管理多个项目：

```bash
# 全局项目（所有目录共享配置）
opencode --global

# 项目特定配置
cd /path/to/project1
opencode

# 同时运行多个实例（不同端口）
opencode serve --port 4096
opencode serve --port 4097
```

### 14. 错误排查

遇到问题时：

1. **查看日志**: `opencode --print-logs`
2. **检查配置**: `opencode config list`
3. **验证连接**: `opencode test`
4. **重启服务**: `pkill opencode && opencode`
5. **寻求帮助**: [Discord](https://opencode.ai/discord)

### 15. 安全实践

保护您的数据：

```bash
# 使用环境变量存储敏感信息
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."

# 使用受限权限配置
opencode config set permission.bash ask
opencode config set permission.external_directory.deny "/etc,/usr"

# 定期轮换 API Keys
# 在提供商的网站上生成新密钥
# 使用 opencode provider update 更新
```

---

## 资源链接

- 📖 **OpenCode 文档**: https://opencode.ai/docs
- 💬 **Discord 社区**: https://opencode.ai/discord
- 🐛 **GitHub Issues**: https://github.com/anomalyco/opencode/issues
- 📦 **GitHub 仓库**: https://github.com/anomalyco/opencode
- 🌐 **官方网站**: https://opencode.ai

### 相关文档

- [版本迁移指南](./41-版本迁移指南.md)
- [配置系统深度解析](./30-配置系统深度解析.md)
- [代理系统深度解析](./03-代理系统深度解析.md)
- [工具系统详解](./04-工具系统详解.md)
- [LSP 层实现](./06-LSP层实现.md)

---

_文档版本：1.0.0_
_最后更新：2026-01-22_
_适用版本：OpenCode 1.1.x_
