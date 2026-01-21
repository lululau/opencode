# CLI 命令系统详解

## 目录

1. [系统概述](#系统概述)
2. [架构设计](#架构设计)
3. [Yargs 解析器配置](#yargs-解析器配置)
4. [命令结构](#命令结构)
5. [命令发现与注册](#命令发现与注册)
6. [中间件系统](#中间件系统)
7. [命令执行流程](#命令执行流程)
8. [核心命令详解](#核心命令详解)
9. [自定义命令开发](#自定义命令开发)
10. [最佳实践](#最佳实践)

---

## 系统概述

OpenCode 使用 **Yargs** 作为命令行参数解析器，构建了一个强大且可扩展的 CLI 系统。该系统支持：

- 📦 **模块化命令架构**：每个命令都是独立模块
- 🎯 **灵活的参数解析**：支持位置参数、选项、别名
- 🔄 **中间件支持**：全局和命令级中间件
- 🎨 **交互式 CLI**：集成 `@clack/prompts` 提供友好的用户交互
- 📝 **类型安全**：TypeScript 类型推断和验证
- 🔧 **可扩展性**：轻松添加自定义命令

### 技术栈

| 技术               | 版本          | 用途         |
| ------------------ | ------------- | ------------ |
| **yargs**          | 18.0.0        | CLI 参数解析 |
| **@clack/prompts** | 1.0.0-alpha.1 | 交互式提示   |
| **TypeScript**     | 5.8.2         | 类型系统     |

---

## 架构设计

### 目录结构

```
packages/opencode/
├── src/
│   ├── index.ts                          # CLI 入口文件
│   ├── cli/
│   │   ├── cmd/                          # 命令实现目录
│   │   │   ├── cmd.ts                   # 命令类型定义助手
│   │   │   ├── run.ts                   # run 命令
│   │   │   ├── serve.ts                 # serve 命令
│   │   │   ├── auth.ts                  # auth 命令
│   │   │   ├── agent.ts                 # agent 命令
│   │   │   ├── mcp.ts                  # mcp 命令
│   │   │   ├── web.ts                   # web 命令
│   │   │   ├── session.ts               # session 命令
│   │   │   ├── github.ts                # github 命令
│   │   │   ├── pr.ts                   # pr 命令
│   │   │   ├── models.ts                # models 命令
│   │   │   ├── stats.ts                # stats 命令
│   │   │   ├── export.ts                # export 命令
│   │   │   ├── import.ts                # import 命令
│   │   │   ├── upgrade.ts               # upgrade 命令
│   │   │   ├── uninstall.ts             # uninstall 命令
│   │   │   ├── generate.ts              # generate 命令
│   │   │   ├── acp.ts                  # acp 命令
│   │   │   ├── debug/                  # debug 命令组
│   │   │   └── tui/                   # TUI 相关命令
│   │   ├── bootstrap.ts                 # CLI 启动逻辑
│   │   ├── error.ts                     # 错误格式化
│   │   ├── network.ts                   # 网络选项助手
│   │   ├── ui.ts                       # UI 输出助手
│   │   └── upgrade.ts                  # 升级逻辑
│   └── ...
└── bin/
    └── opencode                        # 二进制入口包装器
```

### 高层架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     用户输入                             │
│                  opencode <command>                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              bin/opencode (包装器)                       │
│         • 查找平台特定的二进制文件                       │
│         • 委托给正确的可执行文件                        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│            src/index.ts (CLI 入口)                       │
│         • Yargs 初始化和配置                             │
│         • 全局选项和中间件                              │
│         • 命令注册                                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          Yargs 解析器                                   │
│         • 参数解析和验证                                 │
│         • 中间件执行                                     │
│         • 命令路由                                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              命令处理器 (src/cli/cmd/)                  │
│         • 业务逻辑实现                                     │
│         • 交互式提示                                     │
│         • 结果输出                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Yargs 解析器配置

### 初始化代码

```typescript
// packages/opencode/src/index.ts
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

const cli = yargs(hideBin(process.argv))
  .parserConfiguration({ "populate--": true }) // 保留 -- 后的参数
  .scriptName("opencode")
  .wrap(100) // 帮助文本宽度
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", Installation.VERSION)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
```

### 关键配置选项

| 配置                  | 说明                     | 值                       |
| --------------------- | ------------------------ | ------------------------ |
| `scriptName`          | CLI 脚本名称             | `"opencode"`             |
| `wrap`                | 帮助文本换行宽度         | `100`                    |
| `parserConfiguration` | 解析器行为配置           | `{ "populate--": true }` |
| `strict`              | 严格模式（拒绝未知选项） | `true`                   |

#### `populate--` 选项

```typescript
.parserConfiguration({ "populate--": true })
```

这个配置允许将 `--` 后的所有参数收集到 `args["--"]` 数组中：

```bash
# 命令示例
opencode run build -- --verbose --force

# args["--"] 的值
["--verbose", "--force"]
```

这对于将额外的参数传递给子进程非常有用。

---

## 命令结构

### 基本命令定义

所有命令都遵循统一的定义模式，使用 `cmd()` 辅助函数：

```typescript
// packages/opencode/src/cli/cmd/cmd.ts
import type { CommandModule } from "yargs"

type WithDoubleDash<T> = T & { "--"?: string[] }

export function cmd<T, U>(input: CommandModule<T, WithDoubleDash<U>>) {
  return input
}
```

### 命令模板

```typescript
import { cmd } from "./cmd"
import type { Argv } from "yargs"

export const MyCommand = cmd({
  command: "mycommand [input]", // 命令名称和位置参数
  describe: "Description of command", // 命令描述
  aliases: ["mc"], // 可选：命令别名
  builder: (yargs: Argv) => {
    // 参数构建器
    return yargs
      .positional("input", {
        // 位置参数
        describe: "Input value",
        type: "string",
      })
      .option("flag", {
        // 可选参数
        describe: "A flag",
        type: "boolean",
        default: false,
      })
      .option("number", {
        describe: "A number option",
        type: "number",
        alias: "n", // 短别名
      })
  },
  handler: async (args) => {
    // 命令处理器
    // args 包含解析后的所有参数
    console.log("Input:", args.input)
    console.log("Flag:", args.flag)
    console.log("Number:", args.number)

    // 访问 -- 后的参数
    const extra = args["--"] || []
    console.log("Extra:", extra)
  },
})
```

### 命令组（子命令）

使用 `builder` 添加子命令：

```typescript
// packages/opencode/src/cli/cmd/auth.ts
export const AuthCommand = cmd({
  command: "auth",
  describe: "manage credentials",
  builder: (yargs) =>
    yargs
      .command(AuthLoginCommand) // login 子命令
      .command(AuthLogoutCommand) // logout 子命令
      .command(AuthListCommand) // list 子命令
      .demandCommand(), // 要求必须选择子命令
  async handler() {}, // 父命令无操作
})

export const AuthLoginCommand = cmd({
  command: "login [url]",
  describe: "log in to a provider",
  // ...
})

export const AuthListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list providers",
  // ...
})
```

---

## 命令发现与注册

### 注册流程

在 `src/index.ts` 中注册所有命令：

```typescript
// packages/opencode/src/index.ts
import { RunCommand } from "./cli/cmd/run"
import { AuthCommand } from "./cli/cmd/auth"
import { AgentCommand } from "./cli/cmd/agent"
import { ServeCommand } from "./cli/cmd/serve"
// ... 其他命令导入

const cli = yargs(hideBin(process.argv))
  // 全局配置...
  .completion("completion", "generate shell completion script")
  .command(AcpCommand)
  .command(McpCommand)
  .command(TuiThreadCommand)
  .command(AttachCommand)
  .command(RunCommand)
  .command(GenerateCommand)
  .command(DebugCommand)
  .command(AuthCommand)
  .command(AgentCommand)
  .command(UpgradeCommand)
  .command(UninstallCommand)
  .command(ServeCommand)
  .command(WebCommand)
  .command(ModelsCommand)
  .command(StatsCommand)
  .command(ExportCommand)
  .command(ImportCommand)
  .command(GithubCommand)
  .command(PrCommand)
  .command(SessionCommand)
// ...
```

### 可用命令列表

| 命令                | 描述                     | 类型        |
| ------------------- | ------------------------ | ----------- |
| `[project]`         | 启动 OpenCode TUI        | 默认命令    |
| `run [message..]`   | 运行 OpenCode 并发送消息 | 核心命令    |
| `serve`             | 启动 headless 服务器     | 服务器命令  |
| `web`               | 启动 Web 界面            | Web 命令    |
| `attach <url>`      | 连接到运行中的服务器     | 连接命令    |
| `auth`              | 管理凭据                 | 认证命令    |
| `agent`             | 管理代理                 | 代理命令    |
| `mcp`               | 管理 MCP 服务器          | MCP 命令    |
| `session`           | 管理会话                 | 会话命令    |
| `github`            | 管理 GitHub 集成         | GitHub 命令 |
| `pr <number>`       | 处理 GitHub PR           | PR 命令     |
| `models [provider]` | 列出可用模型             | 模型命令    |
| `stats`             | 显示使用统计             | 统计命令    |
| `export`            | 导出会话数据             | 导出命令    |
| `import`            | 导入会话数据             | 导入命令    |
| `debug`             | 调试工具                 | 调试命令    |
| `acp`               | 启动 ACP 服务器          | ACP 命令    |
| `upgrade`           | 升级 OpenCode            | 升级命令    |
| `uninstall`         | 卸载 OpenCode            | 卸载命令    |
| `completion`        | 生成 shell 补全脚本      | 实用命令    |

---

## 中间件系统

### 全局中间件

在 CLI 初始化时注册的中间件对所有命令执行：

```typescript
.middleware(async (opts) => {
  // 初始化日志系统
  await Log.init({
    print: process.argv.includes("--print-logs"),
    dev: Installation.isLocal(),
    level: (() => {
      if (opts.logLevel) return opts.logLevel as Log.Level
      if (Installation.isLocal()) return "DEBUG"
      return "INFO"
    })(),
  })

  // 设置环境变量
  process.env.AGENT = "1"
  process.env.OPENCODE = "1"

  // 记录启动信息
  Log.Default.info("opencode", {
    version: Installation.VERSION,
    args: process.argv.slice(2),
  })
})
```

### 共享选项模式

通过辅助函数在多个命令间共享选项：

```typescript
// packages/opencode/src/cli/network.ts
import type { Argv, InferredOptionTypes } from "yargs"

const options = {
  port: {
    type: "number" as const,
    describe: "port to listen on",
    default: 0,
  },
  hostname: {
    type: "string" as const,
    describe: "hostname to listen on",
    default: "127.0.0.1",
  },
  mdns: {
    type: "boolean" as const,
    describe: "enable mDNS service discovery (defaults hostname to 0.0.0.0)",
    default: false,
  },
  cors: {
    type: "string" as const,
    array: true,
    describe: "additional domains to allow for CORS",
    default: [] as string[],
  },
}

export type NetworkOptions = InferredOptionTypes<typeof options>

export function withNetworkOptions<T>(yargs: Argv<T>) {
  return yargs.options(options)
}

export async function resolveNetworkOptions(args: NetworkOptions) {
  const config = await Config.global()
  const portExplicitlySet = process.argv.includes("--port")
  const hostnameExplicitlySet = process.argv.includes("--hostname")
  const mdnsExplicitlySet = process.argv.includes("--mdns")
  const corsExplicitlySet = process.argv.includes("--cors")

  const mdns = mdnsExplicitlySet ? args.mdns : (config?.server?.mdns ?? args.mdns)
  const port = portExplicitlySet ? args.port : (config?.server?.port ?? args.port)
  const hostname = hostnameExplicitlySet
    ? args.hostname
    : mdns && !config?.server?.hostname
      ? "0.0.0.0"
      : (config?.server?.hostname ?? args.hostname)
  const configCors = config?.server?.cors ?? []
  const argsCors = Array.isArray(args.cors) ? args.cors : args.cors ? [args.cors] : []
  const cors = [...configCors, ...argsCors]

  return { hostname, port, mdns, cors }
}
```

在命令中使用：

```typescript
export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless opencode server",
  handler: async (args) => {
    const opts = await resolveNetworkOptions(args)
    const server = Server.listen(opts)
    console.log(`opencode server listening on http://${server.hostname}:${server.port}`)
    await new Promise(() => {})
  },
})
```

---

## 命令执行流程

### 执行流程图

```
用户输入命令
    │
    ▼
┌──────────────────┐
│ Yargs 解析参数    │
│ • 验证参数       │
│ • 解析选项       │
│ • 匹配命令       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 执行中间件       │
│ • 全局中间件     │
│ • 命令中间件     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 命令处理器       │
│ • 业务逻辑       │
│ • 错误处理       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 结果输出         │
│ • 成功/失败     │
│ • 格式化输出     │
└──────────────────┘
```

### 错误处理

全局错误处理：

```typescript
const cli = yargs(hideBin(process.argv))
  // ... 配置 ...
  .fail((msg, err) => {
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      if (err) throw err
      cli.showHelp("log") // 显示帮助
    }
    if (err) throw err
    process.exit(1)
  })
  .strict()

try {
  await cli.parse()
} catch (e) {
  let data: Record<string, any> = {}

  if (e instanceof NamedError) {
    const obj = e.toObject()
    Object.assign(data, { ...obj.data })
  }

  if (e instanceof Error) {
    Object.assign(data, {
      name: e.name,
      message: e.message,
      cause: e.cause?.toString(),
      stack: e.stack,
    })
  }

  Log.Default.error("fatal", data)
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error, check log file at " + Log.file() + " for more details" + EOL)
    console.error(e instanceof Error ? e.message : String(e))
  }
  process.exitCode = 1
} finally {
  process.exit()
}
```

---

## 核心命令详解

### 1. run 命令

**功能**：运行 OpenCode 并发送消息到代理。

**签名**：

```bash
opencode run [message..] [options]
```

**选项**：

| 选项             | 类型     | 默认值  | 描述                              |
| ---------------- | -------- | ------- | --------------------------------- |
| `message`        | string[] | []      | 要发送的消息                      |
| `-c, --continue` | boolean  | false   | 继续上一个会话                    |
| `-s, --session`  | string   | -       | 继续指定 ID 的会话                |
| `--share`        | boolean  | false   | 共享会话                          |
| `-m, --model`    | string   | -       | 使用的模型（provider/model 格式） |
| `--agent`        | string   | -       | 使用的代理                        |
| `--format`       | string   | default | 输出格式：default 或 json         |
| `-f, --file`     | string[] | -       | 附加到消息的文件                  |
| `--title`        | string   | -       | 会话标题                          |
| `--attach`       | string   | -       | 连接到运行中的服务器              |
| `--port`         | number   | -       | 本地服务器端口                    |
| `--variant`      | string   | -       | 模型变体（推理努力程度）          |
| `--command`      | string   | -       | 运行的命令，使用 message 作为参数 |

**实现示例**（简化版）：

```typescript
export const RunCommand = cmd({
  command: "run [message..]",
  describe: "run opencode with a message",
  builder: (yargs: Argv) => {
    return yargs
      .positional("message", {
        describe: "message to send",
        type: "string",
        array: true,
        default: [],
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
    // ... 其他选项
  },
  handler: async (args) => {
    // 合并消息
    let message = [...args.message, ...(args["--"] || [])].join(" ")

    // 验证代理
    if (args.agent) {
      const agent = await Agent.get(args.agent)
      if (!agent) {
        UI.error(`agent "${args.agent}" not found`)
        process.exit(1)
      }
    }

    // 创建或继续会话
    const sessionID = await (async () => {
      if (args.continue) {
        const result = await sdk.session.list()
        return result.data?.find((s) => !s.parentID)?.id
      }
      if (args.session) return args.session

      const result = await sdk.session.create({
        title: args.title,
      })
      return result.data?.id
    })()

    // 发送提示
    await sdk.session.prompt({
      sessionID,
      agent: args.agent,
      model: args.model ? Provider.parseModel(args.model) : undefined,
      parts: [{ type: "text", text: message }],
    })

    // 订阅事件流
    const events = await sdk.event.subscribe()
    for await (const event of events.stream) {
      // 处理事件...
    }
  },
})
```

**使用示例**：

```bash
# 运行简单命令
opencode run "Fix the bug in index.ts"

# 继续上一个会话
opencode run -c

# 使用特定模型和代理
opencode run -m anthropic/claude-sonnet-4 --agent plan "Analyze this code"

# 附加文件
opencode run -f README.md -f package.json "Update documentation"

# 连接到远程服务器
opencode run --attach http://localhost:4096 "Hello"

# 以 JSON 格式输出
opencode run --format json "List files"
```

### 2. serve 命令

**功能**：启动 headless OpenCode 服务器。

**签名**：

```bash
opencode serve [options]
```

**选项**：

| 选项         | 类型     | 默认值    | 描述               |
| ------------ | -------- | --------- | ------------------ |
| `--port`     | number   | 0         | 监听端口           |
| `--hostname` | string   | 127.0.0.1 | 监听主机名         |
| `--mdns`     | boolean  | false     | 启用 mDNS 服务发现 |
| `--cors`     | string[] | []        | 额外的 CORS 域名   |

**实现**：

```typescript
export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless opencode server",
  handler: async (args) => {
    if (!Flag.OPENCODE_SERVER_PASSWORD) {
      console.log("Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.")
    }
    const opts = await resolveNetworkOptions(args)
    const server = Server.listen(opts)
    console.log(`opencode server listening on http://${server.hostname}:${server.port}`)
    await new Promise(() => {})
    await server.stop()
  },
})
```

**使用示例**：

```bash
# 启动默认服务器
opencode serve

# 指定端口和主机
opencode serve --port 4096 --hostname 0.0.0.0

# 启用 mDNS
opencode serve --mdns

# 添加 CORS 域名
opencode serve --cors https://example.com --cors https://app.example.com
```

### 3. auth 命令

**功能**：管理 AI 提供商凭据。

**签名**：

```bash
opencode auth [command] [options]
```

**子命令**：

| 子命令        | 别名 | 描述         |
| ------------- | ---- | ------------ |
| `login [url]` | -    | 登录到提供商 |
| `logout`      | -    | 登出提供商   |
| `list`        | `ls` | 列出所有凭据 |

**实现示例**（登录）：

```typescript
export const AuthLoginCommand = cmd({
  command: "login [url]",
  describe: "log in to a provider",
  builder: (yargs) =>
    yargs.positional("url", {
      describe: "opencode auth provider",
      type: "string",
    }),
  async handler(args) {
    prompts.intro("Add credential")

    // 选择提供商
    const providers = await ModelsDev.get()
    const provider = await prompts.autocomplete({
      message: "Select provider",
      options: Object.values(providers).map((p) => ({
        label: p.name,
        value: p.id,
        hint: "recommended",
      })),
    })

    // 输入 API key
    const key = await prompts.password({
      message: "Enter your API key",
      validate: (x) => (x && x.length > 0 ? undefined : "Required"),
    })

    // 保存凭据
    await Auth.set(provider, {
      type: "api",
      key,
    })

    prompts.log.success("Login successful")
    prompts.outro("Done")
  },
})
```

**使用示例**：

```bash
# 登录到提供商（交互式）
opencode auth login

# 列出所有凭据
opencode auth list

# 登出提供商
opencode auth logout
```

### 4. agent 命令

**功能**：管理代理配置。

**签名**：

```bash
opencode agent [command] [options]
```

**子命令**：

| 子命令   | 描述             |
| -------- | ---------------- |
| `create` | 创建新代理       |
| `list`   | 列出所有可用代理 |

**实现示例**（创建代理）：

```typescript
const AgentCreateCommand = cmd({
  command: "create",
  describe: "create a new agent",
  builder: (yargs: Argv) =>
    yargs
      .option("path", {
        type: "string",
        describe: "directory path to generate agent file",
      })
      .option("description", {
        type: "string",
        describe: "what agent should do",
      })
      .option("mode", {
        type: "string",
        describe: "agent mode",
        choices: ["all", "primary", "subagent"] as const,
      })
      .option("tools", {
        type: "string",
        describe: `comma-separated list of tools to enable`,
      }),
  async handler(args) {
    // 获取描述
    const description =
      args.description ||
      (await prompts.text({
        message: "Description",
        placeholder: "What should this agent do?",
      }))

    // 生成代理配置
    const generated = await Agent.generate({ description })

    // 选择工具
    const tools = args.tools
      ? args.tools.split(",")
      : await prompts.multiselect({
          message: "Select tools to enable",
          options: AVAILABLE_TOOLS.map((t) => ({ label: t, value: t })),
        })

    // 选择模式
    const mode =
      args.mode ||
      (await prompts.select({
        message: "Agent mode",
        options: [
          { label: "All", value: "all" },
          { label: "Primary", value: "primary" },
          { label: "Subagent", value: "subagent" },
        ],
      }))

    // 写入文件
    const content = matter.stringify(generated.systemPrompt, {
      description: generated.whenToUse,
      mode,
      tools,
    })

    const filePath = path.join(targetPath, `${generated.identifier}.md`)
    await Bun.write(filePath, content)

    prompts.log.success(`Agent created: ${filePath}`)
  },
})
```

**使用示例**：

```bash
# 交互式创建代理
opencode agent create

# 非交互式创建代理
opencode agent create \
  --path ./agents \
  --description "Code reviewer" \
  --mode primary \
  --tools read,edit,write

# 列出所有代理
opencode agent list
```

### 5. mcp 命令

**功能**：管理 MCP（Model Context Protocol）服务器。

**签名**：

```bash
opencode mcp [command] [options]
```

**子命令**：

| 子命令          | 别名 | 描述                           |
| --------------- | ---- | ------------------------------ |
| `add`           | -    | 添加 MCP 服务器                |
| `list`          | `ls` | 列出 MCP 服务器和状态          |
| `auth [name]`   | -    | 与 OAuth 启用的 MCP 服务器认证 |
| `logout [name]` | -    | 移除 OAuth 凭据                |
| `debug <name>`  | -    | 调试 MCP 连接                  |

**使用示例**：

```bash
# 添加本地 MCP 服务器
opencode mcp add
# 输入：name=filesystem, command=opencode x @modelcontextprotocol/server-filesystem

# 添加远程 MCP 服务器
opencode mcp add
# 输入：name=remote, type=remote, url=https://example.com/mcp

# 列出所有服务器
opencode mcp list

# 认证到 OAuth 服务器
opencode mcp auth remote-server

# 调试 MCP 连接
opencode mcp debug remote-server
```

---

## 自定义命令开发

### 创建新命令的步骤

#### 1. 创建命令文件

在 `packages/opencode/src/cli/cmd/` 目录创建新文件：

```typescript
// packages/opencode/src/cli/cmd/mycommand.ts
import { cmd } from "./cmd"
import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"

export const MyCommand = cmd({
  command: "mycommand [input]",
  describe: "My custom command",
  aliases: ["mc"], // 可选：添加别名

  builder: (yargs: Argv) => {
    return (
      yargs
        // 位置参数
        .positional("input", {
          describe: "Input value",
          type: "string",
          demandOption: false, // 可选
        })
        // 选项
        .option("flag", {
          describe: "A boolean flag",
          type: "boolean",
          default: false,
        })
        .option("count", {
          describe: "A number option",
          type: "number",
          alias: "n", // 短别名
          default: 1,
        })
        .option("output", {
          describe: "Output file",
          type: "string",
        })
    )
  },

  handler: async (args) => {
    // 命令逻辑
    UI.println("My Command Executed")
    UI.println(`Input: ${args.input}`)
    UI.println(`Flag: ${args.flag}`)
    UI.println(`Count: ${args.count}`)

    // 交互式提示
    if (!args.input) {
      const input = await prompts.text({
        message: "Enter input:",
        validate: (x) => (x ? undefined : "Required"),
      })
      UI.println(`You entered: ${input}`)
    }

    // 完成提示
    prompts.outro("Done!")
  },
})
```

#### 2. 注册命令

在 `packages/opencode/src/index.ts` 中导入并注册命令：

```typescript
import { MyCommand } from "./cli/cmd/mycommand"

const cli = yargs(hideBin(process.argv))
  // ... 其他配置
  .command(MyCommand) // 注册你的命令
// ... 其他命令
```

#### 3. 测试命令

```bash
# 编译
bun run --cwd packages/opencode build

# 运行
bun run --cwd packages/opencode dev mycommand --help

# 执行
bun run --cwd packages/opencode dev mycommand hello --flag --count 5
```

### 高级模式

#### 嵌套命令

```typescript
export const ParentCommand = cmd({
  command: "parent",
  describe: "Parent command with subcommands",
  builder: (yargs) => yargs.command(SubCommand1).command(SubCommand2).demandCommand(),
  async handler() {},
})

export const SubCommand1 = cmd({
  command: "sub1",
  describe: "First subcommand",
  async handler() {
    // ...
  },
})

export const SubCommand2 = cmd({
  command: "sub2",
  describe: "Second subcommand",
  async handler() {
    // ...
  },
})
```

#### 使用共享选项

```typescript
import { withNetworkOptions } from "../network"

export const MyServerCommand = cmd({
  command: "myserver",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "My server command",
  handler: async (args) => {
    const opts = await resolveNetworkOptions(args)
    // 使用 opts.port, opts.hostname 等
  },
})
```

#### 交互式命令

```typescript
import * as prompts from "@clack/prompts"

export const InteractiveCommand = cmd({
  command: "interactive",
  describe: "Interactive command example",
  async handler() {
    prompts.intro("Welcome to interactive mode")

    // 文本输入
    const name = await prompts.text({
      message: "What is your name?",
      validate: (x) => (x.length > 0 ? undefined : "Name is required"),
    })

    // 选择
    const choice = await prompts.select({
      message: "Choose an option:",
      options: [
        { label: "Option 1", value: "opt1" },
        { label: "Option 2", value: "opt2" },
      ],
    })

    // 多选
    const items = await prompts.multiselect({
      message: "Select items:",
      options: [
        { label: "Item 1", value: "item1" },
        { label: "Item 2", value: "item2" },
        { label: "Item 3", value: "item3" },
      ],
    })

    // 确认
    const confirmed = await prompts.confirm({
      message: "Do you want to proceed?",
      initialValue: true,
    })

    if (confirmed) {
      const spinner = prompts.spinner()
      spinner.start("Processing...")
      await doWork()
      spinner.stop("Done!")
    }

    prompts.outro("Finished")
  },
})
```

#### 错误处理

```typescript
export const RobustCommand = cmd({
  command: "robust",
  describe: "Command with error handling",
  async handler(args) {
    try {
      // 业务逻辑
      const result = await doSomething(args)

      // 成功输出
      UI.println("Success!")
      UI.println(JSON.stringify(result, null, 2))
    } catch (error) {
      // 错误处理
      if (error instanceof ValidationError) {
        UI.error(`Validation error: ${error.message}`)
        process.exit(1)
      }

      if (error instanceof NotFoundError) {
        UI.error("Resource not found")
        process.exit(1)
      }

      // 未知错误
      UI.error("An unexpected error occurred")
      Log.Default.error("command.error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })

      process.exit(1)
    }
  },
})
```

### 命令开发最佳实践

#### 1. 参数验证

```typescript
builder: (yargs) => {
  return yargs
    .option("email", {
      type: "string",
      validate: (x) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(x) ? true : "Invalid email format"
      },
    })
    .option("age", {
      type: "number",
      validate: (x) => {
        return x > 0 && x < 150 ? true : "Age must be between 1 and 149"
      },
    })
}
```

#### 2. 使用类型推断

```typescript
// 定义选项类型
type MyCommandOptions = {
  input: string
  flag: boolean
  count: number
  output?: string
}

// 使用类型
export const MyCommand = cmd<Record<string, unknown>, MyCommandOptions>({
  command: "mycommand",
  builder: (yargs) => {
    /* ... */
  },
  handler: async (args: MyCommandOptions) => {
    // args 具有完整类型信息
    console.log(args.input) // string
    console.log(args.count) // number
  },
})
```

#### 3. 输出格式化

```typescript
// 使用 UI 助手
import { UI } from "../ui"

export const FormattedCommand = cmd({
  command: "formatted",
  describe: "Command with formatted output",
  async handler() {
    // 普通文本
    UI.println("Normal text")

    // 样式化文本
    UI.println(UI.Style.TEXT_SUCCESS + "Success message")
    UI.println(UI.Style.TEXT_ERROR + "Error message")
    UI.println(UI.Style.TEXT_WARNING + "Warning message")

    // Markdown
    const markdown = """
      # Heading
      **Bold** and *italic*
      - List item 1
      - List item 2
    """
    UI.println(UI.markdown(markdown))

    // 表格
    UI.printTable([
      { Name: "Alice", Age: 30, City: "NYC" },
      { Name: "Bob", Age: 25, City: "LA" },
    ])
  },
})
```

#### 4. 进度显示

```typescript
import * as prompts from "@clack/prompts"

export const ProgressCommand = cmd({
  command: "progress",
  describe: "Command with progress indicator",
  async handler() {
    const spinner = prompts.spinner()

    spinner.start("Initializing...")
    await sleep(1000)
    spinner.message("Processing item 1/10...")
    await sleep(500)
    spinner.message("Processing item 2/10...")
    await sleep(500)
    // ... 更多进度更新

    spinner.stop("Completed successfully!")
  },
})
```

---

## 最佳实践

### 1. 命令设计原则

- **单一职责**：每个命令只做一件事
- **清晰的命名**：使用描述性的命令名称
- **合理的默认值**：为常用选项设置合理的默认值
- **友好的错误消息**：提供清晰的错误提示和解决建议

### 2. 参数处理

- **使用位置参数**：对于必需的、顺序重要的参数
- **使用选项**：对于可选的、有默认值的参数
- **提供别名**：为常用选项提供短别名
- **验证输入**：验证参数的有效性

### 3. 用户体验

- **提供帮助**：每个命令都有清晰的描述
- **支持补全**：生成 shell 补全脚本
- **交互式体验**：使用 `@clack/prompts` 提供友好的交互
- **进度反馈**：长时间运行的操作显示进度

### 4. 代码组织

- **模块化**：每个命令独立文件
- **共享代码**：通过辅助函数共享逻辑
- **类型安全**：充分利用 TypeScript 类型系统
- **错误处理**：统一错误处理和日志记录

### 5. 性能考虑

- **懒加载**：只导入需要的模块
- **异步处理**：使用 async/await 处理 I/O
- **资源清理**：确保在 finally 中清理资源

### 6. 测试

- **单元测试**：测试命令逻辑
- **集成测试**：测试命令与系统的交互
- **手动测试**：在真实环境中测试用户体验

---

## 参考资料

### 相关文档

- [GETTING-STARTED.md](./GETTING-STARTED.md) - 入门指南
- [16-核心命令参考.md](./16-核心命令参考.md) - 核心命令详细参考
- [STYLE_GUIDE.md](../STYLE_GUIDE.md) - 代码风格指南

### 外部资源

- [Yargs 官方文档](https://yargs.js.org/)
- [Clack Prompts 文档](https://github.com/natemoo-re/clack)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)

---

_文档版本：1.0.0_
_最后更新：2026-01-22_
