# OpenCode 文档索引

本索引列出了 OpenCode 项目的详细技术文档。每个文档都会深入探讨 OpenCode 架构和实现的一个特定方面。

---

## 核心架构文档

### [01-架构总览.md](./01-架构总览.md)

**描述**：深入探讨 OpenCode 的整体架构设计，包括客户端-服务器模型、模块化设计、数据流和通信模式。涵盖系统的高层设计决策和架构权衡。

### [02-服务器架构.md](./02-服务器架构.md)

**描述**：详细分析 OpenCode 服务器实现，包括 Hono 框架使用、路由设计、中间件系统、SSE/WebSocket 事件流、错误处理和认证机制。

### [03-代理系统深度解析.md](./03-代理系统深度解析.md)

**描述**：全面讲解 OpenCode 的代理系统，包括代理类型（primary、subagent、all）、代理配置、权限规则、代理编排、子代理调用和自定义代理创建。

### [04-工具系统详解.md](./04-工具系统详解.md)

**描述**：深入分析工具系统的设计和实现，包括工具接口定义、参数验证（Zod）、工具执行、结果格式化、权限集成、以及如何创建自定义工具。

### [05-MCP集成详解.md](./05-MCP集成详解.md)

**描述**：详细讲解 Model Context Protocol (MCP) 集成，包括 MCP 服务器连接管理、工具注册、资源访问、提示词模板管理、以及如何开发自定义 MCP 服务器。

### [06-LSP层实现.md](./06-LSP层实现.md)

**描述**：深入探讨 Language Server Protocol 层，包括 LSP 客户端连接、代码补全、定义跳转、引用查找、符号搜索、诊断信息获取、代码重命名等功能。

### [07-会话管理详解.md](./07-会话管理详解.md)

**描述**：全面讲解会话管理系统，包括会话生命周期、消息存储和检索、事件流管理、会话持久化、会话状态管理、以及父子会话关系。

### [08-权限系统设计.md](./08-权限系统设计.md)

**描述**：详细分析权限系统的设计和实现，包括权限规则定义、模式匹配、动作类型（allow/deny/ask）、权限评估机制、用户交互（权限请求）、以及代理权限隔离。

### [09-存储层架构.md](./09-存储层架构.md)

**描述**：深入探讨存储层设计，包括键值存储实现、会话数据持久化、配置存储、存储接口抽象、以及性能优化策略。

### [10-认证与授权.md](./10-认证与授权.md)

**描述**：详细讲解认证和授权机制，包括身份认证流程（OAuth、API Key）、令牌管理、会话验证、以及安全最佳实践。

---

## 客户端架构文档

### [11-TUI实现详解.md](./11-TUI实现详解.md)

**描述**：深入分析终端用户界面（TUI）实现，包括 OpenTUI 框架集成、终端渲染、键盘交互处理、组件系统、布局管理、主题系统和性能优化。

### [12-Web应用架构.md](./12-Web应用架构.md)

**描述**：详细讲解 Web 应用架构，包括 SolidJS 应用结构、Vite 构建配置、状态管理（响应式 primitives）、路由设计、实时通信（WebSocket）、以及性能优化。

### [13-桌面应用开发.md](./13-桌面应用开发.md)

**描述**：深入探讨桌面应用（Tauri）实现，包括 Tauri 架构、Rust 后端集成、平台特定功能、原生系统调用、打包和分发流程。

### [14-UI组件库.md](./14-UI组件库.md)

**描述**：详细讲解共享 UI 组件库（`packages/ui/`），包括组件设计原则、组件清单、样式系统、无障碍支持、以及组件复用策略。

---

## CLI 与命令系统文档

### [15-CLI命令系统详解.md](./15-CLI命令系统详解.md)

**描述**：全面讲解 CLI 命令系统，包括 Yargs 解析器使用、命令注册和发现、参数和选项定义、命令中间件、命令执行流程、以及如何添加自定义命令。

### [16-核心命令参考.md](./16-核心命令参考.md)

**描述**：详细参考所有核心 CLI 命令，包括 `run`、`serve`、`auth`、`agent`、`mcp`、`web`、`session` 等命令的用法、参数和示例。

### [17-TUI命令详解.md](./17-TUI命令详解.md)

**描述**：深入分析 TUI 特定命令，包括 `tui thread`、`tui attach`、TUI 组件命令、键盘绑定、以及 TUI 与服务器的交互。

---

## AI 集成文档

### [18-AI提供商抽象层.md](./18-AI提供商抽象层.md)

**描述**：详细讲解 AI 提供商抽象层设计，包括提供商接口定义、统一的模型 API、提供商特性、流式响应处理、错误处理、以及如何添加新的提供商。

### [19-Vercel AI SDK集成.md](./19-Vercel AI SDK集成.md)

**描述**：深入分析与 Vercel AI SDK 的集成，包括流式对象生成、工具调用、消息构建、提供商选项配置、以及性能优化技巧。

### [20-支持的AI模型详解.md](./20-支持的AI模型详解.md)

**描述**：全面列出和说明所有支持的 AI 模型和提供商，包括 Anthropic Claude、OpenAI GPT、Google Gemini、Azure OpenAI、Mistral、Groq、Together AI 等的模型特性和适用场景。

### [21-提示词工程.md](./21-提示词工程.md)

**描述**：深入探讨提示词设计和管理，包括系统提示词模板、提示词注入、上下文管理、提示词优化策略、以及如何编写有效的代理提示词。

---

## 开发工具文档

### [22-构建系统详解.md](./22-构建系统详解.md)

**描述**：详细分析构建系统，包括 Bun 构建流程、esbuild 配置、Turborepo monorepo 构建、代码分割、tree-shaking、以及生产优化。

### [23-测试策略.md](./23-测试策略.md)

**描述**：全面讲解测试策略，包括单元测试（Bun Test）、集成测试、E2E 测试（Playwright）、测试覆盖率、测试环境设置、以及持续集成测试。

### [24-调试技巧与工具.md](./24-调试技巧与工具.md)

**描述**：详细讲解调试技巧和工具，包括 Bun Inspector 使用、VSCode 调试配置、服务器调试、TUI 调试、日志系统、性能分析、以及常见问题排查。

### [25-代码风格指南.md](./25-代码风格指南.md)

**描述**：深入讲解代码风格指南，包括命名约定、代码组织原则、TypeScript 最佳实践、函数设计、错误处理模式、以及项目特定的风格规则。

### [26-性能优化.md](./26-性能优化.md)

**描述**：全面讲解性能优化策略，包括启动性能、运行时性能、内存优化、网络优化、渲染性能（TUI/Web）、以及性能分析和监控。

---

## 实战与案例文档

### [37-从零开发新工具.md](./37-从零开发新工具.md)

**描述**：从零开始逐步创建自定义 OpenCode 工具的实战教程，包括需求分析、工具设计、实现步骤、测试策略和发布流程。以天气查询工具为实际案例，展示完整可运行的代码示例。

### [38-创建自定义代理.md](./38-创建自定义代理.md)

**描述**：从零开始创建自定义 OpenCode 代理的实战教程，包括代理需求分析、权限配置、提示词编写、测试和部署。以代码审查代理为实际案例，展示完整可运行的配置示例。

### [39-集成MCP服务器实战.md](./39-集成MCP服务器实战.md)

**描述**：从零开始创建 MCP (Model Context Protocol) 服务器的实战教程，包括 MCP 协议、服务器实现、工具定义、测试调试和部署。以文件管理服务器为实际案例，展示完整可运行的代码示例。

### [40-添加新的AI提供商.md](./40-添加新的AI提供商.md)

**描述**：从零开始添加新的 AI 提供商到 OpenCode 的实战教程，包括提供商接口、模型配置、认证处理、测试验证和贡献流程。以添加自定义提供商为实际案例，展示完整可运行的配置示例。

---

## 高级主题文档

### [27-插件系统详解.md](./27-插件系统详解.md)

**描述**：深入分析插件系统架构，包括插件接口定义、插件生命周期、插件注册、插件隔离、以及如何开发自定义插件。

### [28-扩展开发指南.md](./28-扩展开发指南.md)

**描述**：详细讲解扩展开发，包括扩展类型（工具、代理、提供商）、扩展清单、扩展打包和分发、以及扩展安全模型。

### [29-自定义技能开发.md](./29-自定义技能开发.md)

**描述**：全面讲解技能系统，包括技能定义、技能参数、技能执行、技能与工具的集成、以及如何创建和注册自定义技能。

### [30-配置系统深度解析.md](./30-配置系统深度解析.md)

**描述**：深入探讨配置系统，包括配置文件格式、配置加载顺序、配置验证、环境变量集成、默认配置、以及配置热重载。

---

## 集成与扩展文档

### [34-GitHub集成详解.md](./34-GitHub集成详解.md)

**描述**：全面讲解 GitHub 集成，包括 Issue 智能处理、Pull Request 创建与管理、代码审查、Webhook 事件处理、GitHub Actions 集成、配置与安装、以及 GitHub 集成最佳实践。

### [35-Slack集成详解.md](./35-Slack集成详解.md)

**描述**：详细讲解 Slack Bot 集成，包括 Slack App 设置、消息处理与会话管理、斜杠命令执行、文件上传与处理、实时通知系统、Socket Mode 配置、以及 Slack 集成部署指南。

### [36-IDE集成.md](./36-IDE集成.md)

**描述**：深入探讨 IDE 集成，包括 VSCode 扩展开发、Neovim 插件实现、LSP 客户端管理、编辑器 API 使用、TUI/Web/桌面应用架构、自定义 IDE 集成开发指南。

---

## 实战与案例文档

### [37-从零开发新工具.md](./37-从零开发新工具.md) ✅ 已完成

**描述**：从零开始逐步创建自定义 OpenCode 工具的实战教程，包括需求分析、工具设计、实现步骤、测试策略和发布流程。以天气查询工具为实际案例，展示完整可运行的代码示例。

### [38-创建自定义代理.md](./38-创建自定义代理.md) ✅ 已完成

**描述**：从零开始创建自定义 OpenCode 代理的实战教程，包括代理需求分析、权限配置、提示词编写、测试和部署。以代码审查代理为实际案例，展示完整可运行的配置示例。

### [39-集成MCP服务器实战.md](./39-集成MCP服务器实战.md) ✅ 已完成

**描述**：从零开始创建 MCP (Model Context Protocol) 服务器的实战教程，包括 MCP 协议、服务器实现、工具定义、测试调试和部署。以文件管理服务器为实际案例，展示完整可运行的代码示例。

### [40-添加新的AI提供商.md](./40-添加新的AI提供商.md) ✅ 已完成

**描述**：从零开始添加新的 AI 提供商到 OpenCode 的实战教程，包括提供商接口、模型配置、认证处理、测试验证和贡献流程。以添加自定义提供商为实际案例，展示完整可运行的配置示例。

---

## 基础设施与运维文档

- 31-部署架构详解.md ✅ 已完成
- 32-安全最佳实践.md ✅ 已完成
- 33-监控与日志.md ✅ 已完成

---

## 故障排除文档

### [43-常见问题解答.md](./43-常见问题解答.md) ✅ 已完成

**描述**：全面的常见问题解答，涵盖安装问题（安装脚本失败、权限错误、版本升级、依赖问题）、配置问题（配置文件找不到、格式错误、API Key 配置、模型配置）、运行时错误（启动失败、工作目录、LSP 初始化、权限被拒绝、网络连接）、性能问题（响应速度慢、内存占用高、磁盘 I/O 缓慢、渲染性能）和兼容性问题（操作系统、Node.js 版本、终端、编码、Git 版本）。

### [44-错误代码参考.md](./44-错误代码参考.md) ✅ 已完成

**描述**：完整的错误代码参考，包含 Provider 错误（ModelNotFoundError、InitError、ModelInitError）、Config 错误（JsonError、InvalidError、ConfigDirectoryTypoError）、Storage 错误（NotFoundError）、Session 错误（BusyError、AbortedError、APIError、AuthError、OutputLengthError）、Permission 错误（DeniedError、RejectedError、CorrectedError）、Tool 错误（InvalidError、ExecutionError）、LSP 错误（InitializeError）、File 错误（ExtractionFailedError、DownloadFailedError）、MCP 错误（Failed）和 Worktree 错误（NotGitError、CreateFailedError），每个错误包含错误名称、原因、上下文、解决方案和预防措施。

### [45-调试会话问题.md](./45-调试会话问题.md) ✅ 已完成

**描述**：专注于会话级别的问题诊断和解决，涵盖会话卡住（网络超时、工具执行挂起、上下文窗口溢出、Doom Loop）、消息丢失（存储写入失败、消息序列化失败、事件流中断）、权限错误（权限规则过于严格、权限请求卡住、模式匹配失败）、工具调用失败（工具参数验证失败、工具执行超时、工具权限不足、外部命令失败）、会话恢复（会话 Revert 功能、会话 Fork 功能、会话备份和导出、会话导入）、会话压缩（何时触发、压缩过程、手动压缩、压缩配置、监控压缩）、会话状态（状态类型、查看状态、状态日志、状态转换图）和诊断工具（会话调试命令、消息调试、实时日志监控、性能分析、健康检查）。

---

## 参考资料文档

### [46-API参考.md](./46-API参考.md) ✅ 已完成

**描述**：完整的 REST API 参考文档，包含所有 API 端点、请求/响应格式、认证方式、使用示例。涵盖会话管理 API（list、get、create、delete、update、message、command、shell、revert、summarize、share）、配置管理 API（get、update、providers）、文件操作 API（find、list、read、status）、项目 API（list、current、update）、提供商 API（list、auth、oauth）、权限 API（reply、list）、MCP API（status、add、connect、disconnect、oauth）、全局 API（health、event、dispose）、速率限制和错误响应。每个端点都包含详细的参数说明、请求示例和响应结构。

### [47-类型定义参考.md](./47-类型定义参考.md) ✅ 已完成

**描述**：OpenCode 类型定义的完整参考，包含核心类型、接口、枚举及其在代码库中的位置。涵盖插件系统类型（Hooks、BunShell、PluginInput）、消息系统类型（Part、TextPart、ToolPart、AgentPart、ReasoningPart、FilePart 等）、配置类型（Config.Info、PermissionAction、Agent、Provider）、文件系统类型（File.Info、File.Node、File.Content）、LSP 类型（Range、Symbol、SymbolKind、Status）、Agent 系统类型（Agent.Info）、Provider & Model 类型（Model、Provider）、Permission 类型（PermissionRequest、PermissionResponse）、MCP 类型（Resource、Status）、Tool 类型（Tool.Info）、Session 类型（Session.Info）、Question 类型（Option、Info、Request）、UI 主题类型（OklchColor、ThemeVariant、DesktopTheme）、Patch 类型（ApplyPatchError、Hunk）、PTY 类型（Info、CreateInput、UpdateInput）、SDK 客户端类型（ClientOptions）、工具类型（RetryOptions、Logger）以及使用示例。

### [48-术语表.md](./48-术语表.md) ✅ 已完成

**描述**：OpenCode 技术术语和概念的完整词汇表，包含所有技术术语、缩写和概念及其在代码库中出现的位置。涵盖架构术语（Agent、Session、Workspace、Project、Tool、Task、Permission、Provider、Model）、技术缩写（MCP、SSE、LSP、SDK、ULID、TUI、Vercel AI SDK、Tauri、Hono、Zod、JSONC、CLI）、AI & 语言模型术语（LLM、Stream、Temperature、Top-P、Tool Calling、Function Calling）、协议与通信术语（WebSocket、HTTP、OpenAPI）、配置术语（Environment Variables、Configuration Keys）、权限系统术语（Permission Ruleset、Doom Loop、External Directory、Plan Mode）、会话管理术语（Fork、Compaction、Revert、Share、Session Status）、工具系统术语（Tool State、Skill、Command、Formatter）、文件系统术语（Ignore Patterns、Config Files、Agent Files）、版本控制术语（Worktree、PTY、VCS）、开发模式术语（Plugin、Hook、Event Bus、Snapshot）、UI & 交互术语（OpenTUI、Theme、Keybinds）和特殊功能术语（OpenCode Zen、Instance、Global、Logger、Storage、Identifier）。每个术语都包含定义、上下文含义和相关文档链接。

---

## 开发工具文档

### [22-构建系统详解.md](./22-构建系统详解.md)

**描述**：详细分析构建系统，包括 Bun 构建流程、esbuild 配置、Turborepo monorepo 构建、代码分割、tree-shaking、以及生产优化。

### [23-测试策略.md](./23-测试策略.md)

**描述**：全面讲解测试策略，包括单元测试（Bun Test）、集成测试、E2E 测试（Playwright）、测试覆盖率、测试环境设置、以及持续集成测试。

### [24-调试技巧与工具.md](./24-调试技巧与工具.md)

**描述**：详细讲解调试技巧和工具，包括 Bun Inspector 使用、VSCode 调试配置、服务器调试、TUI 调试、日志系统、性能分析、以及常见问题排查。

### [25-代码风格指南.md](./25-代码风格指南.md)

**描述**：深入讲解代码风格指南，包括命名约定、代码组织原则、TypeScript 最佳实践、函数设计、错误处理模式、以及项目特定的风格规则。

### [26-性能优化.md](./26-性能优化.md)

**描述**：全面讲解性能优化策略，包括启动性能、运行时性能、内存优化、网络优化、渲染性能（TUI/Web）、以及性能分析和监控。

- 18-AI提供商抽象层.md ✅ 已完成
- 19-Vercel AI SDK集成.md ✅ 已完成
- 20-支持的AI模型详解.md ✅ 已完成
- 21-提示词工程.md ✅ 已完成
- 22-构建系统详解.md ✅ 已完成
- 23-测试策略.md ✅ 已完成
- 24-调试技巧与工具.md ✅ 已完成
- 25-代码风格指南.md ✅ 已完成
- 26-性能优化.md ✅ 已完成

---

## 高级主题文档

- 27-插件系统详解.md ✅ 已完成
- 28-扩展开发指南.md ✅ 已完成
- 29-自定义技能开发.md ✅ 已完成
- 30-配置系统深度解析.md ✅ 已完成

---

## 集成与扩展文档

- 34-GitHub集成详解.md ✅ 已完成
- 35-Slack集成详解.md ✅ 已完成
- 36-IDE集成.md ✅ 已完成

---

## 基础设施与运维文档

- 31-部署架构详解.md ✅ 已完成
- 32-安全最佳实践.md ✅ 已完成
- 33-监控与日志.md ✅ 已完成

---

## 贡献与社区文档

### [49-贡献者指南.md](./49-贡献者指南.md) ✅ 已完成

**描述**：全面的贡献指南，包含贡献类型、贡献流程、开发环境设置、代码审查标准、提交规范、Pull Request 最佳实践和社区规范。为潜在贡献者提供清晰的参与项目贡献的指导。

### [50-发布流程.md](./50-发布流程.md) ✅ 已完成

**描述**：详细的发布流程文档，包含版本管理、变更日志、发布类型、发布前检查清单、发布流程、发布后验证、回滚策略和平台特定流程。为维护者提供完整的版本发布和回滚指导。

---

## 如何贡献文档

如果你对编写这些文档感兴趣：

1. **选择文档**：从上述列表中选择一个未开始的文档
2. **声明意图**：在 Issue 中声明你要编写的文档
3. **遵循风格**：参考 `GETTING-STARTED.md` 的格式和风格
4. **包含示例**：尽可能包含代码示例和图示
5. **审查准确性**：确保所有技术细节准确无误
6. **提交 PR**：遵循项目的贡献流程

### 文档质量标准

- ✅ **准确性**：所有技术细节必须准确
- ✅ **完整性**：涵盖主题的所有重要方面
- ✅ **可读性**：使用清晰的语言和结构
- ✅ **示例**：提供实用的代码示例
- ✅ **图示**：使用图表说明复杂概念
- ✅ **时效性**：保持与最新代码同步

---

## 联系与反馈

如果你对文档有任何建议或发现错误：

- 📧 创建 GitHub Issue
- 💬 在 Discord 讨论区提出
- 📝 直接提交 PR 修复或改进

---

_最后更新：2026-01-22_
