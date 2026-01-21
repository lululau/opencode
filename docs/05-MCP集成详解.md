# MCP 集成详解

## 目录

1. [MCP 概述](#mcp-概述)
2. [架构设计](#架构设计)
3. [MCP 服务器连接管理](#mcp-服务器连接管理)
4. [工具注册与执行](#工具注册与执行)
5. [资源访问](#资源访问)
6. [提示词模板管理](#提示词模板管理)
7. [OAuth 认证](#oauth-认证)
8. [配置系统](#配置系统)
9. [CLI 命令](#cli-命令)
10. [API 端点](#api-端点)
11. [事件系统](#事件系统)
12. [开发自定义 MCP 服务器](#开发自定义-mcp-服务器)
13. [最佳实践](#最佳实践)

---

## MCP 概述

Model Context Protocol (MCP) 是一种开放协议，允许 OpenCode 连接到外部服务器，使用额外的工具、资源和提示词。OpenCode 完整支持 MCP 协议，包括：

- **本地 MCP 服务器**：通过标准输入/输出运行的进程
- **远程 MCP 服务器**：通过 HTTP/SSE 连接的远程服务
- **OAuth 认证**：支持 OAuth 2.0 流程的远程服务器
- **动态工具发现**：自动从连接的服务器发现并注册工具
- **资源和提示词**：支持访问 MCP 服务器的资源和提示词模板

### MCP SDK 依赖

OpenCode 使用官方 MCP TypeScript SDK：

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import {
  CallToolResultSchema,
  type Tool as MCPToolDef,
  ToolListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js"
```

版本：`@modelcontextprotocol/sdk` 1.25.2

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                     OpenCode Server                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  │  MCP Client  │  │ MCP Client  │  │ MCP Client  │
│  │  (Local)    │  │ (Remote)   │  │ (Remote)   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
│         │                   │                   │
└─────────┼───────────────────┼───────────────────┘
          │                   │
    ┌─────┴─────┐     ┌─────┴─────┐
    │  Stdio     │     │  HTTP/SSE  │
    │  Transport │     │  Transport  │
    └─────┬─────┘     └─────┬─────┘
          │                   │
    ┌─────┴───────────────────┴─────┐
    │       MCP Servers              │
    │  - Local: command process   │
    │  - Remote: HTTP/SSE API   │
    └──────────────────────────────┘
```

### 核心组件

| 组件               | 位置                                          | 职责                                   |
| ------------------ | --------------------------------------------- | -------------------------------------- |
| **MCP Client**     | `packages/opencode/src/mcp/index.ts`          | MCP 客户端管理、工具注册、连接生命周期 |
| **OAuth Provider** | `packages/opencode/src/mcp/oauth-provider.ts` | OAuth 2.0 认证提供者实现               |
| **Auth Storage**   | `packages/opencode/src/mcp/auth.ts`           | OAuth 令牌和客户端信息持久化           |
| **OAuth Callback** | `packages/opencode/src/mcp/oauth-callback.ts` | OAuth 回调服务器处理                   |
| **Config**         | `packages/opencode/src/config/config.ts`      | MCP 配置模式定义                       |
| **CLI Commands**   | `packages/opencode/src/cli/cmd/mcp.ts`        | MCP 管理命令行接口                     |
| **API Routes**     | `packages/opencode/src/server/routes/mcp.ts`  | MCP 管理的 HTTP API                    |

### 状态管理

OpenCode 使用 `Instance.state()` 模式管理 MCP 客户端状态：

```typescript
// packages/opencode/src/mcp/index.ts
const state = Instance.state(
  async () => {
    // 初始化：从配置加载 MCP 服务器
    const cfg = await Config.get()
    const config = cfg.mcp ?? {}
    const clients: Record<string, MCPClient> = {}
    const status: Record<string, Status> = {}

    // 并行连接所有配置的 MCP 服务器
    await Promise.all(
      Object.entries(config).map(async ([key, mcp]) => {
        const result = await create(key, mcp)
        status[key] = result.status
        if (result.mcpClient) {
          clients[key] = result.mcpClient
        }
      }),
    )

    return { status, clients }
  },
  async (state) => {
    // 清理：关闭所有 MCP 客户端连接
    await Promise.all(
      Object.values(state.clients).map((client) =>
        client.close().catch((error) => {
          log.error("Failed to close MCP client", { error })
        }),
      ),
    )
    pendingOAuthTransports.clear()
  },
)
```

---

## MCP 服务器连接管理

### 连接类型

OpenCode 支持两种 MCP 服务器类型：

#### 1. 本地服务器 (Local)

通过标准输入/输出 (stdio) 与本地进程通信：

```typescript
// packages/opencode/src/config/config.ts
export const McpLocal = z.object({
  type: z.literal("local"),
  command: z.string().array().describe("命令和参数"),
  environment: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
})

// 使用示例
{
  "mcp": {
    "my-local-server": {
      "type": "local",
      "command": ["node", "/path/to/server.js"],
      "environment": {
        "NODE_ENV": "development"
      },
      "timeout": 30000
    }
  }
}
```

**连接流程**：

```typescript
// packages/opencode/src/mcp/index.ts (简化版)
async function createLocal(key: string, mcp: McpLocal) {
  const [cmd, ...args] = mcp.command
  const transport = new StdioClientTransport({
    stderr: "ignore",
    command: cmd,
    args,
    cwd: Instance.directory,
    env: {
      ...process.env,
      ...mcp.environment,
    },
  })

  const client = new Client({
    name: "opencode",
    version: Installation.VERSION,
  })

  await withTimeout(client.connect(transport), mcp.timeout ?? DEFAULT_TIMEOUT)
  registerNotificationHandlers(client, key)

  return { mcpClient: client, status: { status: "connected" } }
}
```

#### 2. 远程服务器 (Remote)

通过 HTTP 或 Server-Sent Events (SSE) 与远程服务通信：

```typescript
// packages/opencode/src/config/config.ts
export const McpRemote = z.object({
  type: z.literal("remote"),
  url: z.string().describe("远程 MCP 服务器 URL"),
  enabled: z.boolean().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  oauth: z.union([McpOAuth, z.literal(false)]).optional(),
  timeout: z.number().int().positive().optional(),
})

// 使用示例
{
  "mcp": {
    "my-remote-server": {
      "type": "remote",
      "url": "https://api.example.com/mcp",
      "headers": {
        "X-Custom-Header": "value"
      },
      "oauth": {
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret",
        "scope": "read write"
      },
      "timeout": 30000
    }
  }
}
```

**连接流程**（支持 OAuth）：

```typescript
// packages/opencode/src/mcp/index.ts (简化版)
async function createRemote(key: string, mcp: McpRemote) {
  // 1. 创建 OAuth 提供者（如果启用）
  const oauthProvider = new McpOAuthProvider(
    key,
    mcp.url,
    { clientId, clientSecret, scope },
    {
      onRedirect: (url) => {
        /* 处理重定向 */
      },
    },
  )

  // 2. 尝试两种传输协议（StreamableHTTP 和 SSE）
  const transports = [
    {
      name: "StreamableHTTP",
      transport: new StreamableHTTPClientTransport(new URL(mcp.url), { authProvider, headers: mcp.headers }),
    },
    {
      name: "SSE",
      transport: new SSEClientTransport(new URL(mcp.url), { authProvider, headers: mcp.headers }),
    },
  ]

  // 3. 依次尝试连接，选择成功的传输协议
  for (const { name, transport } of transports) {
    try {
      const client = new Client({
        name: "opencode",
        version: Installation.VERSION,
      })
      await withTimeout(client.connect(transport), mcp.timeout ?? DEFAULT_TIMEOUT)
      registerNotificationHandlers(client, key)

      return { mcpClient: client, status: { status: "connected" } }
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        // 处理 OAuth 认证错误
        if (error.message.includes("registration")) {
          return {
            mcpClient: undefined,
            status: {
              status: "needs_client_registration",
              error: "Server does not support dynamic client registration",
            },
          }
        } else {
          pendingOAuthTransports.set(key, transport)
          return {
            mcpClient: undefined,
            status: { status: "needs_auth" },
          }
        }
      }
      // 尝试下一个传输协议
    }
  }

  return {
    mcpClient: undefined,
    status: { status: "failed", error: "All transports failed" },
  }
}
```

### 连接状态

OpenCode 使用 discriminated union 类型表示 MCP 服务器状态：

```typescript
// packages/opencode/src/mcp/index.ts
export const Status = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("connected"),
  }),
  z.object({
    status: z.literal("disabled"),
  }),
  z.object({
    status: z.literal("failed"),
    error: z.string(),
  }),
  z.object({
    status: z.literal("needs_auth"),
  }),
  z.object({
    status: z.literal("needs_client_registration"),
    error: z.string(),
  }),
])

export type Status = z.infer<typeof Status>
```

**状态说明**：

| 状态                        | 说明                    | 处理方式               |
| --------------------------- | ----------------------- | ---------------------- |
| `connected`                 | 服务器已连接并可用      | 工具、资源、提示词可用 |
| `disabled`                  | 配置中已禁用            | 不连接，但配置保留     |
| `failed`                    | 连接失败                | 记录错误，显示错误消息 |
| `needs_auth`                | 需要 OAuth 认证         | 触发 OAuth 流程        |
| `needs_client_registration` | 需要预先注册的客户端 ID | 提示用户提供 clientId  |

### 通知处理

OpenCode 注册 MCP 客户端通知以处理动态更新：

```typescript
// packages/opencode/src/mcp/index.ts
function registerNotificationHandlers(client: MCPClient, serverName: string) {
  client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
    log.info("tools list changed notification received", { server: serverName })
    // 发布事件，通知工具列表已更改
    Bus.publish(ToolsChanged, { server: serverName })
  })
}

// 事件定义
export const ToolsChanged = BusEvent.define(
  "mcp.tools.changed",
  z.object({
    server: z.string(),
  }),
)
```

---

## 工具注册与执行

### 工具发现与注册

OpenCode 从所有已连接的 MCP 服务器动态发现并注册工具：

```typescript
// packages/opencode/src/mcp/index.ts
export async function tools() {
  const result: Record<string, Tool> = {}
  const s = await state()
  const cfg = await Config.get()
  const config = cfg.mcp ?? {}
  const clientsSnapshot = await clients()
  const defaultTimeout = cfg.experimental?.mcp_timeout

  // 遍历所有已连接的 MCP 客户端
  for (const [clientName, client] of Object.entries(clientsSnapshot)) {
    // 跳过未连接的客户端
    if (s.status[clientName]?.status !== "connected") {
      continue
    }

    // 从 MCP 服务器获取工具列表
    const toolsResult = await client.listTools().catch((e) => {
      log.error("failed to get tools", { clientName, error: e.message })
      // 标记为失败状态
      s.status[clientName] = { status: "failed", error: e.message }
      delete s.clients[clientName]
      return undefined
    })

    if (!toolsResult) continue

    const mcpConfig = config[clientName]
    const timeout = mcpConfig?.timeout ?? defaultTimeout

    // 转换并注册每个工具
    for (const mcpTool of toolsResult.tools) {
      // 名称规范化（替换特殊字符）
      const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9_-]/g, "_")
      const sanitizedToolName = mcpTool.name.replace(/[^a-zA-Z0-9_-]/g, "_")

      // 构建工具名称：clientName_toolName
      const toolKey = sanitizedClientName + "_" + sanitizedToolName
      result[toolKey] = await convertMcpTool(mcpTool, client, timeout)
    }
  }

  return result
}
```

### 工具转换

OpenCode 将 MCP 工具定义转换为 AI SDK Tool 格式：

```typescript
// packages/opencode/src/mcp/index.ts
async function convertMcpTool(mcpTool: MCPToolDef, client: MCPClient, timeout?: number): Promise<Tool> {
  const inputSchema = mcpTool.inputSchema

  // 构建 JSON Schema
  const schema: JSONSchema7 = {
    ...(inputSchema as JSONSchema7),
    type: "object",
    properties: (inputSchema.properties ?? {}) as JSONSchema7["properties"],
    additionalProperties: false,
  }

  // 使用 Vercel AI SDK 的 dynamicTool
  return dynamicTool({
    description: mcpTool.description ?? "",
    inputSchema: jsonSchema(schema),
    execute: async (args: unknown) => {
      // 调用 MCP 工具
      return client.callTool(
        {
          name: mcpTool.name,
          arguments: args as Record<string, unknown>,
        },
        CallToolResultSchema,
        {
          resetTimeoutOnProgress: true,
          timeout,
        },
      )
    },
  })
}
```

### 工具执行流程

```
用户请求 → MCP.tools() → 工具列表 → 代理调用工具 → client.callTool() → MCP 服务器 → 返回结果
```

**执行步骤**：

1. **用户请求**：用户在提示词中引用 MCP 工具
2. **工具发现**：`MCP.tools()` 返回所有已注册的工具
3. **代理调用**：代理通过 AI SDK 工具系统调用工具
4. **执行**：`client.callTool()` 发送请求到 MCP 服务器
5. **返回**：MCP 服务器返回结果，传递给用户

### 工具权限集成

MCP 工具继承 OpenCode 的权限系统：

```typescript
// packages/opencode/src/session/prompt.ts
for (const [key, item] of Object.entries(await MCP.tools())) {
  const execute = item.execute
  if (!execute) continue

  // 包装执行以添加插件钩子和权限检查
  item.execute = async (args, opts) => {
    const ctx = context(args, opts)

    // 触发执行前插件钩子
    await Plugin.trigger(
      "tool.execute.before",
      { tool: key, sessionID: ctx.sessionID, callID: opts.toolCallId },
      { args },
    )

    // 请求权限
    await ctx.ask({
      permission: key,
      metadata: {},
      patterns: ["*"],
      always: ["*"],
    })

    // 执行工具
    const result = await execute(args, opts)

    // 触发执行后插件钩子
    await Plugin.trigger("tool.execute.after", { tool: key, sessionID: ctx.sessionID, callID: opts.toolCallId }, result)

    return result
  }
}
```

---

## 资源访问

### 资源发现

OpenCode 从 MCP 服务器发现可用资源：

```typescript
// packages/opencode/src/mcp/index.ts
export async function resources() {
  const s = await state()
  const clientsSnapshot = await clients()

  const result = Object.fromEntries<ResourceInfo & { client: string }>(
    (
      await Promise.all(
        Object.entries(clientsSnapshot).map(async ([clientName, client]) => {
          if (s.status[clientName]?.status !== "connected") {
            return []
          }

          return Object.entries((await fetchResourcesForClient(clientName, client)) ?? {})
        }),
      )
    ).flat(),
  )

  return result
}

async function fetchResourcesForClient(clientName: string, client: Client) {
  const resources = await client.listResources().catch((e) => {
    log.error("failed to get resources", { clientName, error: e.message })
    return undefined
  })

  if (!resources) return

  const result: Record<string, ResourceInfo & { client: string }> = {}

  for (const resource of resources.resources) {
    const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9_-]/g, "_")
    const sanitizedResourceName = resource.name.replace(/[^a-zA-Z0-9_-]/g, "_")
    const key = sanitizedClientName + ":" + sanitizedResourceName

    result[key] = { ...resource, client: clientName }
  }

  return result
}
```

### 资源读取

在会话提示词中，OpenCode 自动处理 MCP 资源：

```typescript
// packages/opencode/src/session/prompt.ts
// 检查消息部分是否为 MCP 资源
if (part.source?.type === "resource") {
  const { clientName, uri } = part.source

  log.info("mcp resource", { clientName, uri, mime: part.mime })

  // 读取资源内容
  const resourceContent = await MCP.readResource(clientName, uri)
  if (!resourceContent) {
    throw new Error(`Resource not found: ${clientName}/${uri}`)
  }

  // 处理不同内容类型
  const contents = Array.isArray(resourceContent.contents) ? resourceContent.contents : [resourceContent.contents]

  const pieces: MessageV2.Part[] = [
    {
      type: "text",
      synthetic: true,
      text: `Reading MCP resource: ${part.filename} (${uri})`,
    },
  ]

  for (const content of contents) {
    if ("text" in content && content.text) {
      // 文本内容
      pieces.push({
        type: "text",
        synthetic: true,
        text: content.text as string,
      })
    } else if ("blob" in content && content.blob) {
      // 二进制内容
      const mimeType = "mimeType" in content ? content.mimeType : part.mime
      pieces.push({
        type: "text",
        synthetic: true,
        text: `[Binary content: ${mimeType}]`,
      })
    }
  }

  return pieces
}
```

### 资源类型

| 类型            | 描述       | 处理方式                   |
| --------------- | ---------- | -------------------------- |
| `text`          | 纯文本内容 | 直接添加到上下文           |
| `blob`          | 二进制数据 | 显示 MIME 类型，不直接嵌入 |
| `resource_link` | 资源引用   | 延迟加载，仅嵌入链接       |

---

## 提示词模板管理

### 提示词发现

OpenCode 从 MCP 服务器发现提示词模板：

```typescript
// packages/opencode/src/mcp/index.ts
export async function prompts() {
  const s = await state()
  const clientsSnapshot = await clients()

  const prompts = Object.fromEntries<PromptInfo & { client: string }>(
    (
      await Promise.all(
        Object.entries(clientsSnapshot).map(async ([clientName, client]) => {
          if (s.status[clientName]?.status !== "connected") {
            return []
          }

          return Object.entries((await fetchPromptsForClient(clientName, client)) ?? {})
        }),
      )
    ).flat(),
  )

  return prompts
}

async function fetchPromptsForClient(clientName: string, client: Client) {
  const prompts = await client.listPrompts().catch((e) => {
    log.error("failed to get prompts", { clientName, error: e.message })
    return undefined
  })

  if (!prompts) return

  const result: Record<string, PromptInfo & { client: string }> = {}

  for (const prompt of prompts.prompts) {
    const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9_-]/g, "_")
    const sanitizedPromptName = prompt.name.replace(/[^a-zA-Z0-9_-]/g, "_")
    const key = sanitizedClientName + ":" + sanitizedPromptName

    result[key] = { ...prompt, client: clientName }
  }

  return result
}
```

### 提示词获取与使用

在命令行中，OpenCode 提供 MCP 提示词：

```typescript
// packages/opencode/src/command/index.ts
for (const [name, prompt] of Object.entries(await MCP.prompts())) {
  commands[name] = {
    description: prompt.description,
    mcp: true,
    execute: async (input) => {
      const template = await MCP.getPrompt(name, input)
      return {
        output: template?.messages?.map((m) => m.content).join("\n") ?? "",
        metadata: {},
      }
    },
  }
}
```

### 提示词参数验证

提示词参数由 MCP 服务器定义，OpenCode 传递原始参数：

```typescript
// packages/opencode/src/mcp/index.ts
export async function getPrompt(clientName: string, name: string, args?: Record<string, string>) {
  const clientsSnapshot = await clients()
  const client = clientsSnapshot[clientName]

  if (!client) {
    log.warn("client not found for prompt", { clientName, name })
    return undefined
  }

  // 调用 MCP 提示词
  const result = await client
    .getPrompt({
      name: name,
      arguments: args,
    })
    .catch((e) => {
      log.error("failed to get prompt from MCP server", {
        clientName,
        promptName: name,
        error: e.message,
      })
      return undefined
    })

  return result
}
```

---

## OAuth 认证

### OAuth 提供者实现

OpenCode 实现完整的 OAuth 2.0 客户端：

```typescript
// packages/opencode/src/mcp/oauth-provider.ts
export class McpOAuthProvider implements OAuthClientProvider {
  constructor(
    private mcpName: string,
    private serverUrl: string,
    private config: McpOAuthConfig,
    private callbacks: McpOAuthCallbacks,
  ) {}

  get redirectUrl(): string {
    // OpenCode 本地回调端口
    return `http://127.0.0.1:19876/mcp/oauth/callback`
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      client_name: "OpenCode",
      client_uri: "https://opencode.ai",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: this.config.clientSecret ? "client_secret_post" : "none",
    }
  }
}
```

### 认证流程

```
1. 用户触发认证 → MCP.startAuth()
2. 生成 OAuth state 参数 → 随机 32 字节
3. 创建传输协议 → StreamableHTTPClientTransport + authProvider
4. 尝试连接 → client.connect()
5. 捕获 UnauthorizedError → 获取 authorization_url
6. 打开浏览器 → open(authorizationUrl)
7. 用户授权 → 重定向到回调
8. 回调处理 → McpOAuthCallback 接收 code
9. 完成认证 → transport.finishAuth(code)
10. 重新连接 → 使用新令牌建立连接
```

**代码示例**：

```typescript
// packages/opencode/src/mcp/index.ts
export async function startAuth(mcpName: string): Promise<{ authorizationUrl: string }> {
  // 1. 获取 MCP 配置
  const mcpConfig = cfg.mcp?.[mcpName]
  if (!mcpConfig || mcpConfig.type !== "remote" || mcpConfig.oauth === false) {
    throw new Error("Invalid MCP server for OAuth")
  }

  // 2. 启动回调服务器
  await McpOAuthCallback.ensureRunning()

  // 3. 生成并存储 state 参数（CSRF 保护）
  const oauthState = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  await McpAuth.updateOAuthState(mcpName, oauthState)

  // 4. 创建 OAuth 提供者和传输协议
  const authProvider = new McpOAuthProvider(
    mcpName,
    mcpConfig.url,
    { clientId, clientSecret, scope },
    {
      onRedirect: (url) => {
        capturedUrl = url
      },
    },
  )

  const transport = new StreamableHTTPClientTransport(new URL(mcpConfig.url), { authProvider })

  // 5. 尝试连接，触发 OAuth 流程
  try {
    const client = new Client({
      name: "opencode",
      version: Installation.VERSION,
    })
    await client.connect(transport)
    // 已认证，无需重定向
    return { authorizationUrl: "" }
  } catch (error) {
    if (error instanceof UnauthorizedError && capturedUrl) {
      // 存储 transport 用于 finishAuth
      pendingOAuthTransports.set(mcpName, transport)
      return { authorizationUrl: capturedUrl.toString() }
    }
    throw error
  }
}

export async function finishAuth(mcpName: string, authorizationCode: string): Promise<Status> {
  // 1. 获取待认证的传输协议
  const transport = pendingOAuthTransports.get(mcpName)
  if (!transport) {
    throw new Error(`No pending OAuth flow for MCP server: ${mcpName}`)
  }

  try {
    // 2. 完成认证（交换 code 为 token）
    await transport.finishAuth(authorizationCode)

    // 3. 清理 code verifier
    await McpAuth.clearCodeVerifier(mcpName)

    // 4. 重新连接（使用新 token）
    pendingOAuthTransports.delete(mcpName)
    const result = await add(mcpName, mcpConfig)

    return result.status[mcpName] ?? { status: "failed", error: "Unknown error" }
  } catch (error) {
    log.error("failed to finish oauth", { mcpName, error })
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
```

### 令牌存储

OAuth 令牌安全存储在本地文件中：

```typescript
// packages/opencode/src/mcp/auth.ts
export namespace McpAuth {
  // 令牌模式
  export const Tokens = z.object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    expiresAt: z.number().optional(),
    scope: z.string().optional(),
  })

  // 客户端信息模式
  export const ClientInfo = z.object({
    clientId: z.string(),
    clientSecret: z.string().optional(),
    clientIdIssuedAt: z.number().optional(),
    clientSecretExpiresAt: z.number().optional(),
  })

  // 存储条目模式
  export const Entry = z.object({
    tokens: Tokens.optional(),
    clientInfo: ClientInfo.optional(),
    codeVerifier: z.string().optional(),
    oauthState: z.string().optional(),
    serverUrl: z.string().optional(),
  })

  const filepath = path.join(Global.Path.data, "mcp-auth.json")

  // 存储函数
  export async function set(mcpName: string, entry: Entry, serverUrl?: string): Promise<void> {
    const file = Bun.file(filepath)
    const data = await all()
    if (serverUrl) {
      entry.serverUrl = serverUrl
    }
    await Bun.write(file, JSON.stringify({ ...data, [mcpName]: entry }, null, 2))
    // 设置文件权限为仅所有者可读写
    await fs.chmod(file.name!, 0o600)
  }

  // 检查令牌过期
  export async function isTokenExpired(mcpName: string): Promise<boolean | null> {
    const entry = await get(mcpName)
    if (!entry?.tokens) return null
    if (!entry.tokens.expiresAt) return false
    return entry.tokens.expiresAt < Date.now() / 1000
  }
}
```

### 回调服务器

OpenCode 在端口 19876 运行本地 OAuth 回调服务器：

```typescript
// packages/opencode/src/mcp/oauth-callback.ts
export namespace McpOAuthCallback {
  const OAUTH_CALLBACK_PORT = 19876
  const OAUTH_CALLBACK_PATH = "/mcp/oauth/callback"

  export async function ensureRunning(): Promise<void> {
    if (server) return

    // 检查端口是否被占用
    if (await isPortInUse()) {
      log.info("oauth callback server already running")
      return
    }

    // 启动 HTTP 服务器
    server = Bun.serve({
      port: OAUTH_CALLBACK_PORT,
      fetch(req) {
        const url = new URL(req.url)

        if (url.pathname !== OAUTH_CALLBACK_PATH) {
          return new Response("Not found", { status: 404 })
        }

        const code = url.searchParams.get("code")
        const state = url.searchParams.get("state")
        const error = url.searchParams.get("error")
        const errorDescription = url.searchParams.get("error_description")

        // 验证 state 参数（CSRF 保护）
        if (!state) {
          return new Response(HTML_ERROR("Missing state parameter"), {
            status: 400,
            headers: { "Content-Type": "text/html" },
          })
        }

        if (error) {
          // 处理错误回调
          if (pendingAuths.has(state)) {
            const pending = pendingAuths.get(state)!
            clearTimeout(pending.timeout)
            pendingAuths.delete(state)
            pending.reject(new Error(errorDescription || error))
          }
          return new Response(HTML_ERROR(errorDescription || error), {
            status: 400,
            headers: { "Content-Type": "text/html" },
          })
        }

        if (code && pendingAuths.has(state)) {
          // 成功回调：解析 code
          const pending = pendingAuths.get(state)!
          clearTimeout(pending.timeout)
          pendingAuths.delete(state)
          pending.resolve(code)
        }

        // 返回成功页面
        return new Response(HTML_SUCCESS, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      },
    })
  }
}
```

### 动态客户端注册

如果 MCP 服务器支持 RFC 7591 动态客户端注册，OpenCode 自动处理：

```typescript
// packages/opencode/src/mcp/oauth-provider.ts
export class McpOAuthProvider implements OAuthClientProvider {
  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    // 1. 优先使用配置中的预注册客户端
    if (this.config.clientId) {
      return {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }
    }

    // 2. 检查存储的动态注册信息
    const entry = await McpAuth.getForUrl(this.mcpName, this.serverUrl)
    if (entry?.clientInfo) {
      // 检查客户端密钥是否过期
      if (entry.clientInfo.clientSecretExpiresAt && entry.clientInfo.clientSecretExpiresAt < Date.now() / 1000) {
        log.info("client secret expired, need to re-register")
        return undefined
      }
      return {
        client_id: entry.clientInfo.clientId,
        client_secret: entry.clientInfo.clientSecret,
      }
    }

    // 3. 无客户端信息，触发动态注册
    return undefined
  }

  async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
    // 保存动态注册的客户端信息
    await McpAuth.updateClientInfo(
      this.mcpName,
      {
        clientId: info.client_id,
        clientSecret: info.client_secret,
        clientIdIssuedAt: info.client_id_issued_at,
        clientSecretExpiresAt: info.client_secret_expires_at,
      },
      this.serverUrl,
    )
    log.info("saved dynamically registered client", {
      mcpName: this.mcpName,
      clientId: info.client_id,
    })
  }
}
```

---

## 配置系统

### MCP 配置结构

OpenCode 使用 Zod 模式定义 MCP 配置：

```typescript
// packages/opencode/src/config/config.ts
export const Mcp = z.discriminatedUnion("type", [
  McpLocal, // 本地服务器
  McpRemote, // 远程服务器
])

export type Mcp = z.infer<typeof Mcp>
```

### 配置文件示例

在 `opencode.json` 中配置 MCP 服务器：

```json
{
  "mcp": {
    // 本地服务器示例
    "filesystem": {
      "type": "local",
      "command": ["node", "/path/to/filesystem-server.js"],
      "environment": {
        "NODE_ENV": "production"
      },
      "timeout": 30000
    },

    // 远程服务器示例（自动 OAuth）
    "api-server": {
      "type": "remote",
      "url": "https://api.example.com/mcp",
      "enabled": true,
      "headers": {
        "X-API-Version": "v1"
      },
      "timeout": 30000
    },

    // 远程服务器示例（预注册 OAuth）
    "enterprise-server": {
      "type": "remote",
      "url": "https://enterprise.example.com/mcp",
      "oauth": {
        "clientId": "your-pre-registered-client-id",
        "clientSecret": "your-client-secret",
        "scope": "read write"
      },
      "timeout": 30000
    },

    // 远程服务器示例（禁用 OAuth）
    "public-server": {
      "type": "remote",
      "url": "https://public.example.com/mcp",
      "oauth": false
    }
  }
}
```

### 配置选项

| 字段          | 类型                     | 必填   | 默认值   | 说明                     |
| ------------- | ------------------------ | ------ | -------- | ------------------------ |
| `type`        | `"local"` \| `"remote"`  | ✅     | -        | 服务器类型               |
| `command`     | `string[]`               | local  | -        | 命令和参数（仅 local）   |
| `url`         | `string`                 | remote | -        | 服务器 URL（仅 remote）  |
| `enabled`     | `boolean`                | ❌     | `true`   | 是否在启动时连接         |
| `environment` | `Record<string, string>` | ❌     | `{}`     | 环境变量（仅 local）     |
| `headers`     | `Record<string, string>` | ❌     | -        | HTTP 请求头（仅 remote） |
| `oauth`       | `McpOAuth` \| `false`    | ❌     | 自动检测 | OAuth 配置（仅 remote）  |
| `timeout`     | `number`                 | ❌     | `30000`  | 请求超时（毫秒）         |

---

## CLI 命令

### 列出 MCP 服务器

```bash
opencode mcp list
```

**功能**：显示所有配置的 MCP 服务器及其状态

**输出示例**：

```
✓ filesystem connected
    node /path/to/server.js

⚠ api-server needs authentication (OAuth)
    https://api.example.com/mcp

✗ enterprise-server failed
    Invalid client credentials

○ public-server disabled
    https://public.example.com/mcp
```

### 添加 MCP 服务器

```bash
opencode mcp add
```

**交互流程**：

1. 输入服务器名称
2. 选择服务器类型（local/remote）
3. 配置服务器参数
4. 自动更新 `opencode.json`

### OAuth 认证

```bash
# 列出可认证的服务器
opencode mcp auth

# 认证特定服务器
opencode mcp auth my-server
```

**认证流程**：

1. 选择要认证的服务器
2. 自动打开浏览器
3. 用户完成授权
4. 保存访问令牌

### 移除 OAuth 凭据

```bash
opencode mcp logout
```

**功能**：删除指定服务器的 OAuth 令牌和客户端信息

### 调试 OAuth

```bash
opencode mcp debug <server-name>
```

**功能**：显示 OAuth 配置、令牌状态、客户端注册信息

---

## API 端点

OpenCode 通过 HTTP API 提供 MCP 管理功能：

### 获取 MCP 状态

```http
GET /mcp
```

**响应**：

```json
{
  "filesystem": {
    "status": "connected"
  },
  "api-server": {
    "status": "needs_auth"
  },
  "public-server": {
    "status": "disabled"
  }
}
```

### 添加 MCP 服务器

```http
POST /mcp
Content-Type: application/json

{
  "name": "new-server",
  "config": {
    "type": "remote",
    "url": "https://example.com/mcp"
  }
}
```

### 启动 OAuth 流程

```http
POST /mcp/:name/auth
```

**响应**：

```json
{
  "authorizationUrl": "https://auth.example.com/authorize?..."
}
```

### 完成 OAuth 认证

```http
POST /mcp/:name/auth/callback
Content-Type: application/json

{
  "code": "authorization_code_from_provider"
}
```

### 连接/断开服务器

```http
POST /mcp/:name/connect
POST /mcp/:name/disconnect
```

---

## 事件系统

### 工具列表更改事件

当 MCP 服务器的工具列表发生变化时触发：

```typescript
// packages/opencode/src/mcp/index.ts
export const ToolsChanged = BusEvent.define(
  "mcp.tools.changed",
  z.object({
    server: z.string(),
  }),
)

// 在 TUI 中监听事件
Bus.subscribe(MCP.ToolsChanged, (evt) => {
  console.log(`Tools changed for server: ${evt.properties.server}`)
  // 刷新工具列表，更新 UI
})
```

### 浏览器打开失败事件

当无法自动打开浏览器时触发：

```typescript
export const BrowserOpenFailed = BusEvent.define(
  "mcp.browser.open.failed",
  z.object({
    mcpName: z.string(),
    url: z.string(),
  }),
)

// 在 CLI 中处理事件
Bus.subscribe(MCP.BrowserOpenFailed, (evt) => {
  console.log(`Failed to open browser for ${evt.properties.mcpName}`)
  console.log(`Please manually open: ${evt.properties.url}`)
})
```

---

## 开发自定义 MCP 服务器

### 项目设置

创建新的 TypeScript 项目：

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript tsx @types/node
```

### 简单工具服务器示例

```typescript
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

const server = new McpServer({
  name: "my-mcp-server",
  version: "1.0.0",
})

// 注册工具
server.tool(
  "add_numbers",
  {
    description: "Add two numbers together",
    inputSchema: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    }),
  },
  async ({ a, b }) => {
    const result = a + b
    return {
      content: [
        {
          type: "text",
          text: `${a} + ${b} = ${result}`,
        },
      ],
    }
  },
)

// 启动服务器
const transport = new StdioServerTransport()
await server.connect(transport)
```

### 资源服务器示例

```typescript
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

const server = new McpServer({
  name: "resource-server",
  version: "1.0.0",
})

// 注册资源
server.resource(
  "config",
  "config://app",
  {
    description: "Application configuration",
    mimeType: "application/json",
  },
  async (uri) => {
    const config = {
      appName: "My App",
      version: "1.0.0",
    }
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(config, null, 2),
        },
      ],
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
```

### OAuth 支持的服务器

```typescript
// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
  metadataHandler,
  requireAuth,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/handlers/metadata.js"

const server = new McpServer({
  name: "oauth-server",
  version: "1.0.0",
})

// 注册工具（受认证保护）
server.tool("protected_action", { description: "Action requiring auth" }, async () => {
  return {
    content: [
      {
        type: "text",
        text: "Authenticated action completed",
      },
    ],
  }
})

// 设置元数据端点
app.use(
  "/.well-known/oauth-authorization-server",
  metadataHandler({
    issuer: "https://your-auth-server.com",
    authorization_endpoint: new URL("/authorize", ISSUER).href,
    token_endpoint: new URL("/oauth/token", ISSUER).href,
    registration_endpoint: new URL("/oidc/register", ISSUER).href,
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    grant_types_supported: ["authorization_code", "refresh_token"],
  }),
)

// 认证中间件
app.get("/mcp", requireAuth(), async (req, res) => {
  const transport = new SSEServerTransport("/messages", res)
  await server.connect(transport)
})
```

### 测试 MCP 服务器

使用官方 MCP Inspector 工具：

```bash
npx @modelcontextprotocol/inspector
```

Inspector 提供图形界面测试工具、资源和提示词。

### OpenCode 集成测试

将新服务器添加到 OpenCode：

```json
{
  "mcp": {
    "my-server": {
      "type": "local",
      "command": ["tsx", "/path/to/server/src/index.ts"]
    }
  }
}
```

启动 OpenCode 并验证：

```bash
opencode
# 在 TUI 中运行：/help
# 查看已注册的工具
```

---

## 最佳实践

### 工具设计

1. **清晰的描述**：提供详细的工具描述和参数说明
2. **Zod 验证**：使用 Zod 定义输入参数，自动生成 JSON Schema
3. **错误处理**：返回包含错误信息的结构化响应
4. **进度更新**：对于长时间运行的操作，使用进度通知

```typescript
server.tool(
  "process_data",
  {
    description: "Process large dataset with progress updates",
    inputSchema: z.object({
      dataset: z.string().describe("Dataset identifier"),
      options: z
        .object({
          verbose: z.boolean().optional(),
        })
        .optional(),
    }),
  },
  async ({ dataset, options }) => {
    // 发送进度通知
    await sendNotification("progress/update", {
      progress: 0,
      message: "Starting...",
    })

    // 处理数据...
    await sendNotification("progress/update", {
      progress: 50,
      message: "Processing...",
    })

    await sendNotification("progress/update", {
      progress: 100,
      message: "Complete",
    })

    return {
      content: [
        {
          type: "text",
          text: "Processing complete",
        },
      ],
    }
  },
)
```

### 资源设计

1. **只读访问**：资源应避免副作用，仅返回数据
2. **适当分块**：大文件应支持分块读取
3. **缓存友好**：使用稳定的 URI，支持客户端缓存

```typescript
server.resource(
  "document",
  "file:///path/to/document.md",
  {
    description: "Documentation file",
    mimeType: "text/markdown",
  },
  async (uri) => {
    // 支持范围查询
    const range = extractRange(uri)

    if (range) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: document.slice(range.start, range.end),
          },
        ],
      }
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: document,
        },
      ],
    }
  },
)
```

### OAuth 集成

1. **标准端点**：实现 `/oauth/token` 和 `/authorize` 端点
2. **PKCE**：支持 Proof Key for Code Exchange
3. **令牌刷新**：实现 refresh_token 流程
4. **作用域管理**：清晰定义和验证作用域

### 性能优化

1. **工具超时**：为长时间运行的工具设置合理超时
2. **连接池**：重用 MCP 客户端连接
3. **错误恢复**：实现重试逻辑和优雅降级
4. **日志记录**：记录详细的调试信息用于故障排除

```typescript
// 配置超时
{
  "mcp": {
    "my-server": {
      "type": "remote",
      "url": "https://example.com/mcp",
      "timeout": 60000  // 60 秒超时
    }
  }
}
```

### 安全性

1. **令牌存储**：使用安全的文件权限（0o600）
2. **CSRF 保护**：使用 state 参数防止跨站请求伪造
3. **验证重定向**：验证回调 URL 与配置匹配
4. **作用域限制**：请求最小必要的作用域

```typescript
// OpenCode 使用的安全措施
await fs.chmod(file.name!, 0o600) // 仅所有者可读写

// CSRF 保护
const oauthState = Array.from(crypto.getRandomValues(new Uint8Array(32)))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("")
```

### 故障排除

| 问题                        | 原因                 | 解决方案                          |
| --------------------------- | -------------------- | --------------------------------- |
| `needs_auth` 状态           | 令牌过期或未认证     | 运行 `opencode mcp auth <server>` |
| `needs_client_registration` | 服务器不支持动态注册 | 在配置中提供预注册的 `clientId`   |
| 连接超时                    | 服务器响应慢         | 增加 `timeout` 配置值             |
| 工具未显示                  | 工具列表更改         | 检查 `mcp.tools.changed` 事件     |

---

## 参考资源

- **MCP 官方文档**：https://modelcontextprotocol.io
- **TypeScript SDK**：https://github.com/modelcontextprotocol/typescript-sdk
- **MCP Inspector**：`npx @modelcontextprotocol/inspector`
- **OpenCode 配置**：`packages/opencode/src/config/config.ts`
- **MCP 实现**：`packages/opencode/src/mcp/`

---

_文档版本：1.0.0_
_最后更新：2026-01-21_
