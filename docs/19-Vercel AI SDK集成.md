# Vercel AI SDK 集成

## 目录

1. [概述](#概述)
2. [SDK 集成](#sdk-集成)
3. [流式对象生成](#流式对象生成)
4. [工具/函数调用](#工具函数调用)
5. [消息构建](#消息构建)
6. [性能优化](#性能优化)

---

## 概述

OpenCode 深度集成了 Vercel AI SDK（`ai` 包 v5.0.119），作为其核心 LLM 抽象层。该集成支持 18+ 个提供商（OpenAI、Anthropic、Google、Azure 等），通过统一的接口提供一致的 API 体验。

### 核心集成点

- **主 LLM 入口** (`/packages/opencode/src/session/llm.ts`) - 使用 `streamText()` 包装提供商特定逻辑
- **提供商抽象** (`/packages/opencode/src/provider/provider.ts`) - 支持多个 AI SDK 包的统一接口
- **结构化生成** (`/packages/opencode/src/agent/agent.ts`) - 使用 `generateObject()` 和 `streamObject()`
- **消息架构** (`/packages/opencode/src/session/message-v2.ts`) - 多部分消息结构
- **工具系统** (`/packages/opencode/src/tool/registry.ts`) - 动态工具注册表

---

## SDK 集成

### 核心导入

```typescript
import {
  streamText,
  wrapLanguageModel,
  type ModelMessage,
  type StreamTextResult,
  type Tool,
  type ToolSet,
  extractReasoningMiddleware,
  tool,
  jsonSchema,
} from "ai"
```

### 主 LLM 流式函数

`LLM.stream()` 是 OpenCode 与 Vercel AI SDK 的主要集成点：

```typescript
export async function stream(input: StreamInput): StreamTextResult<ToolSet, unknown> {
  const [language, cfg, provider, auth] = await Promise.all([
    Provider.getLanguage(input.model),
    Config.get(),
    Provider.getProvider(input.model.providerID),
    Auth.get(input.model.providerID),
  ])

  const isCodex = provider.id === "openai" && auth?.type === "oauth"

  // 构建系统提示词（两层结构以优化缓存）
  const system = SystemPrompt.header(input.model.providerID)
  system.push(
    [
      ...(input.agent.prompt ? [input.agent.prompt] : isCodex ? [] : SystemPrompt.provider(input.model)),
      ...input.system,
      ...(input.user.system ? [input.user.system] : []),
    ]
      .filter((x) => x)
      .join("\n"),
  )

  // 获取提供商特定的参数和选项
  const params = await Plugin.trigger(
    "chat.params",
    {
      sessionID: input.sessionID,
      agent: input.agent,
      model: input.model,
      provider,
      message: input.user,
    },
    {
      temperature: input.model.capabilities.temperature
        ? (input.agent.temperature ?? ProviderTransform.temperature(input.model))
        : undefined,
      topP: input.agent.topP ?? ProviderTransform.topP(input.model),
      topK: ProviderTransform.topK(input.model),
      options: ProviderTransform.options({
        model: input.model,
        sessionID: input.sessionID,
        providerOptions: provider.options,
      }),
    },
  )

  // 解析工具（应用权限过滤）
  const tools = await resolveTools(input)

  return streamText({
    onError(error) {
      l.error("stream error", { error })
    },
    experimental_repairToolCall(failed) {
      // 尝试修复工具名称大小写
      const lower = failed.toolCall.toolName.toLowerCase()
      if (lower !== failed.toolCall.toolName && tools[lower]) {
        l.info("repairing tool call", {
          tool: failed.toolCall.toolName,
          repaired: lower,
        })
        return { ...failed.toolCall, toolName: lower }
      }
      // 使用 invalid 工具报告错误
      return {
        ...failed.toolCall,
        input: JSON.stringify({
          tool: failed.toolCall.toolName,
          error: failed.error.message,
        }),
        toolName: "invalid",
      }
    },
    temperature: params.temperature,
    topP: params.topP,
    topK: params.topK,
    providerOptions: ProviderTransform.providerOptions(input.model, params.options),
    activeTools: Object.keys(tools).filter((x) => x !== "invalid" && x !== "_noop"),
    tools,
    maxOutputTokens,
    abortSignal: input.abort,
    headers: {
      ...(input.model.providerID.startsWith("opencode")
        ? {
            "x-opencode-project": Instance.project.id,
            "x-opencode-session": input.sessionID,
            "x-opencode-request": input.user.id,
            "x-opencode-client": Flag.OPENCODE_CLIENT,
          }
        : undefined),
      ...input.model.headers,
      ...headers,
    },
    maxRetries: input.retries ?? 0,
    messages: [
      ...(isCodex
        ? [{ role: "user", content: system.join("\n\n") }]
        : system.map((x) => ({ role: "system", content: x }))),
      ...input.messages,
    ],
    model: wrapLanguageModel({
      model: language,
      middleware: [
        {
          async transformParams(args) {
            if (args.type === "stream") {
              // 转换消息为提供商特定格式
              args.params.prompt = ProviderTransform.message(args.params.prompt, input.model, options)
            }
            return args.params
          },
        },
        extractReasoningMiddleware({ tagName: "think", startWithReasoning: false }),
      ],
    }),
    experimental_telemetry: { isEnabled: cfg.experimental?.openTelemetry },
  })
}
```

### 提供商包装

使用 `wrapLanguageModel()` 添加中间件层：

```typescript
model: wrapLanguageModel({
  model: language, // 来自提供商的原始语言模型
  middleware: [
    // 消息转换中间件
    {
      async transformParams(args) {
        if (args.type === "stream") {
          // 转换消息为提供商特定格式
          args.params.prompt = ProviderTransform.message(args.params.prompt, input.model, options)
        }
        return args.params
      },
    },
    // 推理提取中间件
    extractReasoningMiddleware({ tagName: "think", startWithReasoning: false }),
  ],
})
```

---

## 流式对象生成

### streamText - 主聊天流

用于主要的聊天交互，流式传输文本内容：

```typescript
return streamText({
  // ... 配置
  messages: [...system.map((x) => ({ role: "system", content: x })), ...input.messages],
  model: wrapLanguageModel({
    /* 中间件 */
  }),
})
```

**流式事件处理：**

在 `processor.ts` 中处理以下事件：

| 事件类型           | 用途                        |
| ------------------ | --------------------------- |
| `text-start`       | 开始文本部分                |
| `text-delta`       | 追加文本增量                |
| `text-end`         | 完成文本部分                |
| `tool-input-start` | 创建待执行工具              |
| `tool-call`        | 工具开始运行                |
| `tool-result`      | 工具执行完成                |
| `tool-error`       | 工具执行失败                |
| `reasoning-start`  | 开始推理内容                |
| `reasoning-delta`  | 追加推理增量                |
| `reasoning-end`    | 完成推理内容                |
| `finish-step`      | 步骤完成（包含 usage 统计） |
| `finish`           | 整个响应完成                |
| `error`            | 发生错误                    |

**增量更新：**

文本部分使用增量更新以最小化数据传输：

```typescript
case "text-delta":
  if (currentText) {
    currentText.text += value.text
    if (value.providerMetadata) currentText.metadata = value.providerMetadata
    // 仅发送新文本
    if (currentText.text)
      await Session.updatePart({
        part: currentText,
        delta: value.text,
      })
  }
```

### generateObject - 结构化生成

用于需要验证的、非流式的结构化输出：

```typescript
// 在 agent.ts 中用于代理生成
const params = {
  experimental_telemetry: { /* ... */ },
  temperature: 0.3,
  messages: [
    ...system.map((x) => ({ role: "system", content: x })),
    { role: "user", content: /* 代理生成提示词 */ },
  ],
  model: language,
  schema: z.object({
    identifier: z.string().describe("Short, memorable name"),
    whenToUse: z.string().describe("When to trigger this agent"),
    systemPrompt: z.string().describe("Full system prompt"),
  }),
}

const result = await generateObject(params)
return result.object
```

### streamObject - 结构化流式生成

用于流式结构化输出（如 OpenAI Codex）：

```typescript
const result = streamObject({ ...params, providerOptions: /* ... */ })
for await (const part of result.fullStream) {
  if (part.type === "error") throw part.error
}
return result.object
```

---

## 工具/函数调用

### 工具定义

使用 AI SDK 的 `tool()` 函数：

```typescript
tools[item.id] = tool({
  id: item.id as any,
  description: item.description,
  inputSchema: jsonSchema(schema as any), // Zod schema 转换为 JSON Schema
  async execute(args, options) {
    const ctx = context(args, options)
    await Plugin.trigger(
      "tool.execute.before",
      {
        /* ... */
      },
      { args },
    )
    const result = await item.execute(args, ctx)
    await Plugin.trigger(
      "tool.execute.after",
      {
        /* ... */
      },
      result,
    )
    return result
  },
  toModelOutput(result) {
    return {
      type: "text",
      value: result.output,
    }
  },
})
```

### 工具调用流程

1. **工具输入开始** (`tool-input-start`): 创建状态为 `pending` 的部分
2. **工具调用** (`tool-call`): 更新为 `running` 并附带输入参数
3. **工具结果** (`tool-result`): 标记为 `completed` 并附带输出
4. **工具错误** (`tool-error`): 标记为 `error` 并附带错误消息

### 批量工具执行

特殊的 `batch` 工具可并行执行多达 25 个独立的工具调用：

```typescript
const BatchTool = Tool.define("batch", async () => {
  return {
    description: "并发执行多个独立的工具调用",
    parameters: z.object({
      tool_calls: z
        .array(
          z.object({
            tool: z.string(),
            parameters: z.object({}).loose(),
          }),
        )
        .min(1)
        .max(25),
    }),
    async execute(params, ctx) {
      const toolCalls = params.tool_calls.slice(0, 25) // 限制为 25 个
      // 并行执行所有调用
      const results = await Promise.all(toolCalls.map((call) => executeCall(call)))
      return {
        title: `批量执行 (${successful}/${total} 成功)`,
        output: summaryMessage,
        metadata: {
          totalCalls: results.length,
          successful: successfulCount,
          failed: failedCount,
          details: results.map((r) => ({ tool: r.tool, success: r.success })),
        },
      }
    },
  }
})
```

**性能优势：** 2-5 倍效率提升（并行 vs 顺序执行）

### Doom 循环检测

防止 3 次或更多相同的工具调用（死循环）：

```typescript
// 在 processor.ts 中
if (toolCallCount >= 3 && isIdenticalToolCall(currentToolCall, lastToolCalls)) {
  throw new Error(`Doom loop detected: Tool ${tool} called 3+ times with identical parameters`)
}
```

### 权限过滤

工具在执行前根据代理权限进行过滤：

```typescript
const disabled = PermissionNext.disabled(Object.keys(input.tools), input.agent.permission)
for (const tool of Object.keys(input.tools)) {
  if (input.user.tools?.[tool] === false || disabled.has(tool)) {
    delete input.tools[tool] // 移除禁用的工具
  }
}
```

**权限类型：**

- `allow`: 始终允许
- `deny`: 始终阻止
- `ask`: 请求用户批准（显示 UI 提示）
- `always`: 自动批准匹配的模式

### 工具调用修复

AI SDK 的 `experimental_repairToolCall` 尝试修复常见的工具调用错误：

```typescript
async experimental_repairToolCall(failed) {
  // 尝试小写工具名称（常见错误）
  const lower = failed.toolCall.toolName.toLowerCase()
  if (lower !== failed.toolCall.toolName && tools[lower]) {
    l.info("repairing tool call", {
      tool: failed.toolCall.toolName,
      repaired: lower,
    })
    return { ...failed.toolCall, toolName: lower }
  }
  // 返回到特殊的 invalid 工具以报告错误
  return {
    ...failed.toolCall,
    input: JSON.stringify({
      tool: failed.toolCall.toolName,
      error: failed.error.message,
    }),
    toolName: "invalid",
  }
}
```

---

## 消息构建

### 消息架构

OpenCode 使用多部分消息结构：

```typescript
export namespace MessageV2 {
  export const Info = z.object({
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    sessionID: z.string(),
    agent: z.string(),
    model: z.object({
      providerID: z.string(),
      modelID: z.string(),
    }),
    time: z.object({
      created: z.number(),
      completed: z.number().optional(),
    }),
    tokens: z.object({
      input: z.number(),
      output: z.number(),
      reasoning: z.number(),
      cache: z.object({ read: z.number(), write: z.number() }),
    }),
    cost: z.number(),
    system: z.string().optional(),
    tools: z.record(z.string(), z.boolean()).optional(),
    variant: z.string().optional(),
  })

  // 部分类型
  export const TextPart = z.object({
    type: z.literal("text"),
    text: z.string(),
    synthetic: z.boolean().optional(), // 系统自动生成
    ignored: z.boolean().optional(),
    time: z.object({ start, end }).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })

  export const FilePart = z.object({
    type: z.literal("file"),
    mime: z.string(),
    filename: z.string().optional(),
    url: z.string(), // data: URI 或 file:// URI
    source: z
      .object({
        type: z.enum(["file", "symbol", "resource"]),
        path: z.string(),
        range: LSP.Range.optional(), // 用于符号
        clientName: z.string().optional(), // 用于 MCP 资源
        uri: z.string().optional(),
      })
      .optional(),
  })

  export const ToolPart = z.object({
    type: z.literal("tool"),
    tool: z.string(),
    callID: z.string(),
    state: z.discriminatedUnion("status", [
      // pending: 工具已请求但未启动
      z.object({ status: z.literal("pending"), input: z.object({}), time: z.object({}) }),
      // running: 工具正在执行
      z.object({ status: z.literal("running"), input: z.object({}), raw: z.string().optional(), time: z.object({}) }),
      // completed: 工具成功完成
      z.object({
        status: z.literal("completed"),
        input: z.object({}),
        output: z.string(),
        title: z.string(),
        metadata: z.record(z.string(), z.any()),
        time: z.object({}),
        attachments: z.array(FilePart),
      }),
      // error: 工具失败
      z.object({ status: z.literal("error"), input: z.object({}), error: z.string(), time: z.object({}) }),
    ]),
  })

  export const ReasoningPart = z.object({
    type: z.literal("reasoning"),
    text: z.string(),
    metadata: z.record(z.string(), z.any()).optional(),
    time: z.object({ start, end }),
  })

  export const AgentPart = z.object({
    type: z.literal("agent"),
    name: z.string(),
    source: z.object({ value: z.string(), start: z.number(), end: z.number() }).optional(),
  })

  export const CompactionPart = z.object({
    type: z.literal("compaction"),
    auto: z.boolean(), // True 表示自动触发
  })

  export const SubtaskPart = z.object({
    type: z.literal("subtask"),
    prompt: z.string(),
    description: z.string(),
    agent: z.string(),
    model: z.object({ providerID, modelID }).optional(),
    command: z.string().optional(),
  })

  export const PatchPart = z.object({
    type: z.literal("patch"),
    hash: z.string(),
    files: z.array(z.string()), // 此步骤修改的文件
  })

  export const SnapshotPart = z.object({
    type: z.literal("snapshot"),
    snapshot: z.string(), // 快照 ID
  })

  export const RetryPart = z.object({
    type: z.literal("retry"),
    attempt: z.number(),
    error: APIError.Schema,
    time: z.object({ created: z.number() }),
  })
}
```

### 消息转换

`ProviderTransform.message()` 按提供商规范化消息：

```typescript
function normalizeMessages(
  msgs: ModelMessage[],
  model: Provider.Model,
  options: Record<string, unknown>,
): ModelMessage[] {
  // 1. Anthropic: 过滤空内容
  if (model.api.npm === "@ai-sdk/anthropic") {
    msgs = msgs
      .map((msg) => {
        if (typeof msg.content === "string" && msg.content === "") return undefined
        if (Array.isArray(msg.content)) {
          const filtered = msg.content.filter((part) => {
            if (part.type === "text" || part.type === "reasoning") {
              return part.text !== ""
            }
            return true
          })
          if (filtered.length === 0) return undefined
          return { ...msg, content: filtered }
        }
        return msg
      })
      .filter((msg): msg is ModelMessage => msg !== undefined && msg.content !== "")
  }

  // 2. Claude: 清理工具调用 ID
  if (model.api.id.includes("claude")) {
    msgs = msgs.map((msg) => {
      if ((msg.role === "assistant" || msg.role === "tool") && Array.isArray(msg.content)) {
        msg.content = msg.content.map((part) => {
          if ((part.type === "tool-call" || part.type === "tool-result") && "toolCallId" in part) {
            return {
              ...part,
              toolCallId: part.toolCallId.replace(/[^a-zA-Z0-9_-]/g, "_"), // 仅字母数字 + 下划线 + 连字符
            }
          }
          return part
        })
      }
      return msg
    })
  }

  // 3. Mistral: 工具调用 ID 清理（9 字符限制，字母数字）
  if (model.providerID === "mistral" || model.api.id.toLowerCase().includes("mistral")) {
    msgs = msgs.map((msg) => {
      // 工具调用 ID 规范化为恰好 9 个字母数字字符
    })
  }

  // 4. 处理交错推理
  if (typeof model.capabilities.interleaved === "object" && model.capabilities.interleaved.field) {
    msgs = msgs.map((msg) => {
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        const reasoningParts = msg.content.filter((part: any) => part.type === "reasoning")
        const reasoningText = reasoningParts.map((part: any) => part.text).join("")
        const filteredContent = msg.content.filter((part: any) => part.type !== "reasoning")

        if (reasoningText) {
          return {
            ...msg,
            content: filteredContent,
            providerOptions: {
              ...msg.providerOptions,
              openaiCompatible: {
                ...(msg.providerOptions as any)?.openaiCompatible,
                [field]: reasoningText, // 如 "reasoning_content" 或 "thinking"
              },
            },
          }
        }
        return msg
      }
      return msg
    })
  }

  return msgs
}
```

### 推理提取

使用 `extractReasoningMiddleware` 自动提取 `<think>` 标签中的推理内容：

```typescript
extractReasoningMiddleware({
  tagName: "think", // 要查找的 XML 标签名
  startWithReasoning: false,
})
```

这会自动将 ``标签中的内容提取为单独的`ReasoningPart` 条目。

---

## 性能优化

### 1. 提示词缓存

对系统消息和最后 2 条消息应用缓存头（`transform.ts` - lines 164-204）：

```typescript
function applyCaching(msgs: ModelMessage[], providerID: string): ModelMessage[] {
  const system = msgs.filter((msg) => msg.role === "system").slice(0, 2)
  const final = msgs.filter((msg) => msg.role !== "system").slice(-2)

  const providerOptions = {
    anthropic: { cacheControl: { type: "ephemeral" } },
    openrouter: { cacheControl: { type: "ephemeral" } },
    bedrock: { cachePoint: { type: "ephemeral" } },
    openaiCompatible: { cache_control: { type: "ephemeral" } },
  }

  for (const msg of unique([...system, ...final])) {
    msg.providerOptions = {
      ...msg.providerOptions,
      ...providerOptions,
    }
  }

  return msgs
}
```

**好处：** 减少重复提示词成本，提高响应速度

### 2. 消息压缩

自动总结旧消息以减少 token 使用（`compaction.ts`）：

```typescript
if (await SessionCompaction.isOverflow({ tokens: lastFinished.tokens, model })) {
  await SessionCompaction.create({
    sessionID,
    agent: lastUser.agent,
    model: lastUser.model,
    auto: true, // 自动触发
  })
  continue // 用压缩后的上下文重新循环
}
```

**压缩策略：**

- 保护最近 40K tokens
- 删除旧工具输出
- 保留 "我们做了什么"、"我们在做什么" 和 "接下来要做什么"

### 3. 并行工具执行

批量工具使用 `Promise.all` 并行执行：

```typescript
const results = await Promise.all(toolCalls.map((call) => executeCall(call)))
```

**效率提升：** 2-5 倍（并行 vs 顺序）

### 4. Delta 流式传输

文本部分使用增量更新以最小化带宽：

```typescript
case "text-delta":
  if (currentText) {
    currentText.text += value.text
    // 仅发送新文本
    await Session.updatePart({
      part: currentText,
      delta: value.text,
    })
  }
```

### 5. 工具调用限制

批量工具限制为 25 个调用以防止系统过载：

```typescript
const toolCalls = params.tool_calls.slice(0, 25)
const discardedCalls = params.tool_calls.slice(25)
```

### 6. 输出截断

大型工具输出被截断并保存到磁盘（`truncation.ts`）：

```typescript
const truncated = await Truncate.output(textParts.join("\n\n"), {}, agent)
const metadata = {
  ...(result.metadata ?? {}),
  truncated: truncated.truncated,
  ...(truncated.truncated && { outputPath: truncated.outputPath }),
}

return {
  title: "",
  metadata,
  output: truncated.content, // 截断后的内容
  attachments,
  content: result.content,
}
```

用户看到截断摘要和文件路径，而不是完整的大输出。

### 7. Abort 信号支持

所有异步操作检查 abort 信号以立即取消：

```typescript
input.abort.throwIfAborted()
```

### 8. 提供商特定选项

不同提供商获得优化的设置（`transform.ts` - lines 530-602）：

```typescript
export function options(input: { model; sessionID; providerOptions }): Record<string, any> {
  const result: Record<string, any> = {}

  // OpenAI: 禁用训练数据存储
  if (model.api.npm === "@ai-sdk/openai") {
    result["store"] = false
  }

  // Google: 启用思考
  if (model.api.npm === "@ai-sdk/google") {
    result["thinkingConfig"] = { includeThoughts: true }
    if (model.api.id.includes("gemini-3")) {
      result["thinkingConfig"]["thinkingLevel"] = "high"
    }
  }

  // OpenCode: 提示词缓存键
  if (model.providerID === "openai") {
    result["promptCacheKey"] = input.sessionID
  }

  return { ...result, ...providerOptions }
}
```

### 9. 最大输出 Token 计算

针对推理模型调整输出限制（`transform.ts` - lines 632-655）：

```typescript
export function maxOutputTokens(
  npm: string,
  options: Record<string, any>,
  modelLimit: number,
  globalLimit: number,
): number {
  const modelCap = modelLimit || globalLimit
  const standardLimit = Math.min(modelCap, globalLimit)

  if (npm === "@ai-sdk/anthropic") {
    const thinking = options?.["thinking"]
    const budgetTokens = typeof thinking?.["budgetTokens"] === "number" ? thinking["budgetTokens"] : 0
    const enabled = thinking?.["type"] === "enabled"
    if (enabled && budgetTokens > 0) {
      // 返回文本 tokens 使得 text + thinking <= 模型限制
      if (budgetTokens + standardLimit <= modelCap) {
        return standardLimit
      }
      return modelCap - budgetTokens // 为思考预算调整
    }
  }

  return standardLimit
}
```

### 10. LiteLLM 代理兼容性

```typescript
// LiteLLM 和某些 Anthropic 代理要求工具参数存在
// 当消息历史包含工具调用时，即使没有使用任何工具
const isLiteLLMProxy =
  provider.options?.["litellmProxy"] === true ||
  input.model.providerID.toLowerCase().includes("litellm") ||
  input.model.api.id.toLowerCase().includes("litellm")

if (isLiteLLMProxy && Object.keys(tools).length === 0 && hasToolCalls(input.messages)) {
  tools["_noop"] = tool({
    description: "LiteLLM/Anthropic 代理兼容的占位符...",
    inputSchema: jsonSchema({ type: "object", properties: {} }),
    execute: async () => ({ output: "", title: "", metadata: {} }),
  })
}
```

### 11. 提供商特定的温度和采样默认值

```typescript
temperature: {
  qwen: 0.55,
  claude: undefined,  // 使用模型默认值
  gemini: 1.0,
  "glm-4.6": 1.0,
  "glm-4.7": 1.0,
  "minimax-m2": 1.0,
  "kimi-k2": 1.0,
  "kimi-k2-thinking": 1.0
}

topP: {
  qwen: 1,
  minimax-m2: 0.95,
  gemini: 0.95
}

topK: {
  minimax-m2: 20,
  gemini: 64
}
```

### 12. OpenTelemetry 支持

```typescript
experimental_telemetry: {
  isEnabled: cfg.experimental?.openTelemetry
}
```

启用遥测以监控性能和调试问题。

---

## 使用示例

### 流式聊天

```typescript
import { LLM } from "@/session/llm"
import { Provider } from "@/provider/provider"

const model = await Provider.getModel("anthropic", "claude-sonnet-4")
const result = await LLM.stream({
  user: { id: "user-1", content: "Hello" },
  sessionID: "session-1",
  model,
  agent: { name: "build", prompt: "" },
  system: [],
  abort: AbortSignal.timeout(30000),
  messages: [],
  tools: {},
  retries: 3,
})

for await (const part of result.fullStream) {
  if (part.type === "text-delta") {
    console.log(part.textDelta)
  }
}
```

### 结构化生成

```typescript
import { generateObject, jsonSchema } from "ai"
import { z } from "zod"

const schema = z.object({
  name: z.string(),
  description: z.string(),
  capabilities: z.array(z.string()),
})

const result = await generateObject({
  model: languageModel,
  schema: jsonSchema(schema),
  messages: [
    { role: "system", content: "Generate a tool definition" },
    { role: "user", content: "Create a tool for reading files" },
  ],
})

console.log(result.object)
// { name: "read", description: "Reads file content", capabilities: ["read"] }
```

### 流式结构化生成

```typescript
import { streamObject } from "ai"

const result = streamObject({
  model: languageModel,
  schema: jsonSchema(schema),
  messages: [
    /* ... */
  ],
})

for await (const part of result.fullStream) {
  if (part.type === "object-delta") {
    console.log("Partial object:", part.partialObject)
  }
}

const final = await result.object
console.log("Final object:", final)
```

---

## 总结

OpenCode 的 Vercel AI SDK 集成提供了：

1. **统一的提供商接口**: 通过 `wrapLanguageModel` 和中间件
2. **流式处理**: 支持 text、tool、reasoning 部分的增量更新
3. **工具系统**: 并行执行、权限过滤、错误恢复
4. **消息架构**: 多部分消息支持丰富的上下文
5. **性能优化**: 缓存、压缩、并行、delta 更新、截断

该集成使开发者能够轻松扩展功能，同时保持与现有代码的一致性。
