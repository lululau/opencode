# Zod 入门指南

> 基于 opencode 项目的 Zod 使用实践

## 目录

1. [什么是 Zod](#什么是-zod)
2. [安装与基本导入](#安装与基本导入)
3. [基础类型](#基础类型)
4. [对象 Schema](#对象-schema)
5. [数组与元组](#数组与元组)
6. [联合类型与判别联合](#联合类型与判别联合)
7. [字面量与枚举](#字面量与枚举)
8. [可选与默认值](#可选与默认值)
9. [高级类型修饰符](#高级类型修饰符)
10. [验证与解析](#验证与解析)
11. [类型推断](#类型推断)
12. [自定义类型与验证](#自定义类型与验证)
13. [Schema 组合与扩展](#schema-组合与扩展)
14. [预处理与转换](#预处理与转换)
15. [元数据与 JSON Schema](#元数据与-json-schema)
16. [实战模式](#实战模式)
17. [错误处理](#错误处理)
18. [最佳实践](#最佳实践)

---

## 什么是 Zod

**Zod** 是一个 TypeScript-first 的 schema 声明和验证库。它允许你：

- 定义数据的结构（schema）
- 在运行时验证数据
- 自动推断 TypeScript 类型
- 提供清晰的验证错误信息

Zod 的核心理念是 **"一次定义，双重使用"**：schema 既是运行时验证器，又是 TypeScript 类型的来源。

### 为什么 opencode 选择 Zod？

opencode 项目广泛使用 Zod 来：
- 验证配置文件
- 定义消息结构
- 验证工具参数
- 确保 API 数据的正确性
- 生成类型安全的代码

---

## 安装与基本导入

### 安装

```bash
# 使用 npm
npm install zod

# 使用 bun
bun add zod
```

### 导入方式

opencode 中使用两种导入方式：

```typescript
// 方式一：默认导入（opencode 中最常用）
import z from "zod"

// 方式二：命名导入
import { z } from "zod"
```

**opencode 示例** - 来自 `src/config/config.ts`：

```typescript
import z from "zod"
```

---

## 基础类型

Zod 支持所有 JavaScript 基础类型：

### 字符串 (string)

```typescript
// 基础字符串
const nameSchema = z.string()

// 带验证的字符串
const emailSchema = z.string().email()
const urlSchema = z.string().url()
const uuidSchema = z.string().uuid()

// 长度限制
const usernameSchema = z.string().min(3).max(20)

// 正则匹配
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)
```

**opencode 示例** - 来自 `src/config/config.ts` (Agent 颜色验证)：

```typescript
color: z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
  .optional()
  .describe("Hex color code for the agent (e.g., #FF5733)")
```

### 数字 (number)

```typescript
// 基础数字
const ageSchema = z.number()

// 带约束的数字
const positiveSchema = z.number().positive()
const integerSchema = z.number().int()
const percentSchema = z.number().min(0).max(100)

// 组合约束
const portSchema = z.number().int().positive().max(65535)
```

**opencode 示例** - 来自 `src/config/config.ts` (端口号验证)：

```typescript
port: z.number().int().positive().optional().describe("Port to listen on")
```

### 布尔值 (boolean)

```typescript
const isActiveSchema = z.boolean()
```

**opencode 示例** - 来自 `src/config/config.ts`：

```typescript
enabled: z.boolean().optional().describe("Enable or disable the MCP server on startup")
```

---

## 对象 Schema

对象是 Zod 中最常用的结构：

### 基础对象

```typescript
const userSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email()
})
```

**opencode 示例** - 来自 `src/session/message-v2.ts` (TextPart)：

```typescript
export const TextPart = PartBase.extend({
  type: z.literal("text"),
  text: z.string(),
  synthetic: z.boolean().optional(),
  ignored: z.boolean().optional(),
  time: z
    .object({
      start: z.number(),
      end: z.number().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
}).meta({
  ref: "TextPart",
})
```

### 嵌套对象

```typescript
const nested = z.object({
  user: z.object({
    profile: z.object({
      name: z.string(),
      bio: z.string().optional()
    })
  })
})
```

**opencode 示例** - 来自 `src/session/index.ts` (Session.Info)：

```typescript
export const Info = z
  .object({
    id: Identifier.schema("session"),
    slug: z.string(),
    projectID: z.string(),
    directory: z.string(),
    time: z.object({
      created: z.number(),
      updated: z.number(),
      compacting: z.number().optional(),
      archived: z.number().optional(),
    }),
    // ... 更多字段
  })
  .meta({ ref: "Session" })
```

### strict() - 严格模式

默认情况下，`z.object()` 会忽略未知属性。使用 `.strict()` 禁止未知属性：

```typescript
// 允许未知属性（默认）
const loose = z.object({ name: z.string() })
loose.parse({ name: "John", age: 30 }) // ✅ 成功，age 被忽略

// 严格模式
const strict = z.object({ name: z.string() }).strict()
strict.parse({ name: "John", age: 30 }) // ❌ 失败，age 是多余的
```

**opencode 示例** - 来自 `src/config/config.ts` (严格验证配置)：

```typescript
export const McpLocal = z
  .object({
    type: z.literal("local").describe("Type of MCP server connection"),
    command: z.string().array().describe("Command and arguments to run the MCP server"),
    // ...
  })
  .strict()  // 不允许额外的未知字段
```

### catchall() - 捕获所有额外属性

```typescript
const schema = z.object({
  name: z.string()
}).catchall(z.number())

// 允许任何额外的 number 属性
schema.parse({ name: "John", age: 30, count: 5 }) // ✅
```

**opencode 示例** - 来自 `src/session/message.ts`：

```typescript
z.object({
  title: z.string(),
  snapshot: z.string().optional(),
  time: z.object({
    start: z.number(),
    end: z.number(),
  }),
}).catchall(z.any())  // 允许任意额外字段
```

---

## 数组与元组

### 数组

```typescript
// 基础数组
const stringsSchema = z.string().array()
// 或者
const stringsSchema2 = z.array(z.string())

// 带长度限制
const limitedArray = z.string().array().min(1).max(10)

// 非空数组
const nonEmpty = z.string().array().nonempty()
```

**opencode 示例** - 来自 `src/session/message-v2.ts`：

```typescript
export const WithParts = z.object({
  info: Info,
  parts: z.array(Part),  // Part 数组
})
```

### 元组

```typescript
// 固定长度和类型的数组
const coordinate = z.tuple([z.number(), z.number()])
coordinate.parse([10, 20]) // ✅ [number, number]
```

---

## 联合类型与判别联合

### 联合类型 (union)

联合类型表示 "或" 关系：

```typescript
const stringOrNumber = z.union([z.string(), z.number()])
stringOrNumber.parse("hello") // ✅
stringOrNumber.parse(42) // ✅
```

**opencode 示例** - 来自 `src/config/config.ts`：

```typescript
timeout: z
  .union([
    z.number().int().positive().describe("Timeout in milliseconds"),
    z.literal(false).describe("Disable timeout entirely."),
  ])
  .optional()
```

### 判别联合 (discriminatedUnion)

当联合类型的每个成员都有一个共同的 "判别字段" 时，使用判别联合可以获得更好的性能和错误提示：

```typescript
// 判别字段是 "type"
const Shape = z.discriminatedUnion("type", [
  z.object({ type: z.literal("circle"), radius: z.number() }),
  z.object({ type: z.literal("square"), side: z.number() }),
  z.object({ type: z.literal("rectangle"), width: z.number(), height: z.number() }),
])

Shape.parse({ type: "circle", radius: 10 }) // ✅
Shape.parse({ type: "square", side: 5 }) // ✅
```

**opencode 示例** - 来自 `src/session/message-v2.ts` (消息部分的判别联合)：

```typescript
export const Part = z
  .discriminatedUnion("type", [
    TextPart,           // type: "text"
    SubtaskPart,        // type: "subtask"
    ReasoningPart,      // type: "reasoning"
    FilePart,           // type: "file"
    ToolPart,           // type: "tool"
    StepStartPart,      // type: "step-start"
    StepFinishPart,     // type: "step-finish"
    SnapshotPart,       // type: "snapshot"
    PatchPart,          // type: "patch"
    AgentPart,          // type: "agent"
    RetryPart,          // type: "retry"
    CompactionPart,     // type: "compaction"
  ])
  .meta({ ref: "Part" })
```

**opencode 示例** - 来自 `src/session/message-v2.ts` (工具状态的判别联合)：

```typescript
export const ToolState = z
  .discriminatedUnion("status", [
    ToolStatePending,    // status: "pending"
    ToolStateRunning,    // status: "running"
    ToolStateCompleted,  // status: "completed"
    ToolStateError,      // status: "error"
  ])
  .meta({ ref: "ToolState" })
```

---

## 字面量与枚举

### 字面量 (literal)

字面量类型表示一个精确的值：

```typescript
const yes = z.literal("yes")
const one = z.literal(1)
const trueVal = z.literal(true)

yes.parse("yes") // ✅
yes.parse("no") // ❌
```

**opencode 示例** - 来自 `src/session/message-v2.ts`：

```typescript
export const TextPart = PartBase.extend({
  type: z.literal("text"),  // 精确匹配 "text" 字符串
  text: z.string(),
})
```

### 枚举 (enum)

枚举表示一组可能的字符串值：

```typescript
const StatusEnum = z.enum(["pending", "active", "completed"])

// 获取枚举值
StatusEnum.enum.pending // "pending"
StatusEnum.options // ["pending", "active", "completed"]
```

**opencode 示例** - 来自 `src/config/config.ts`：

```typescript
// Layout 枚举
export const Layout = z.enum(["auto", "stretch"]).meta({
  ref: "LayoutConfig",
})

// Agent mode 枚举
mode: z.enum(["subagent", "primary", "all"]).optional()

// 分享模式枚举
share: z
  .enum(["manual", "auto", "disabled"])
  .optional()
  .describe("Control sharing behavior")
```

**opencode 示例** - 来自 `src/permission/next.ts`：

```typescript
export const Action = z.enum(["allow", "deny", "ask"]).meta({
  ref: "PermissionAction",
})
```

---

## 可选与默认值

### optional() - 可选字段

```typescript
const schema = z.object({
  required: z.string(),
  optional: z.string().optional(), // string | undefined
})
```

### nullable() - 可为 null

```typescript
const schema = z.string().nullable() // string | null
```

### nullish() - 可为 null 或 undefined

```typescript
const schema = z.string().nullish() // string | null | undefined
```

### default() - 默认值

```typescript
const schema = z.string().default("unnamed")

schema.parse(undefined) // "unnamed"
schema.parse("custom") // "custom"
```

**opencode 示例** - 来自 `src/config/config.ts` (快捷键配置的默认值)：

```typescript
export const Keybinds = z
  .object({
    leader: z.string().optional().default("ctrl+x").describe("Leader key for keybind combinations"),
    app_exit: z.string().optional().default("ctrl+c,ctrl+d,<leader>q").describe("Exit the application"),
    editor_open: z.string().optional().default("<leader>e").describe("Open external editor"),
    theme_list: z.string().optional().default("<leader>t").describe("List available themes"),
    sidebar_toggle: z.string().optional().default("<leader>b").describe("Toggle sidebar"),
    // ... 更多配置
  })
  .strict()
```

---

## 高级类型修饰符

### describe() - 添加描述

描述用于文档、JSON Schema 生成或错误信息：

```typescript
const schema = z.string().describe("User's full name")
```

**opencode 示例** - 几乎所有配置字段都有描述：

```typescript
port: z.number().int().positive().optional().describe("Port to listen on"),
hostname: z.string().optional().describe("Hostname to listen on"),
mdns: z.boolean().optional().describe("Enable mDNS service discovery"),
```

### startsWith() / endsWith() / includes()

字符串特定的验证：

```typescript
const id = z.string().startsWith("usr_")  // 必须以 "usr_" 开头
```

**opencode 示例** - 来自 `src/id/id.ts` (ID 前缀验证)：

```typescript
export function schema(prefix: keyof typeof prefixes) {
  return z.string().startsWith(prefixes[prefix])
}

// 使用
const sessionId = Identifier.schema("session")  // 必须以 "ses" 开头
const messageId = Identifier.schema("message")  // 必须以 "msg" 开头
```

### record() - 记录类型（字典）

```typescript
// 键为字符串，值为数字
const scores = z.record(z.string(), z.number())
scores.parse({ alice: 100, bob: 95 }) // ✅

// 简写：键默认为 string
const simple = z.record(z.number())
```

**opencode 示例** - 来自 `src/config/config.ts`：

```typescript
// 环境变量记录
environment: z
  .record(z.string(), z.string())
  .optional()
  .describe("Environment variables to set when running the MCP server")

// 命令记录
command: z
  .record(z.string(), Command)
  .optional()
  .describe("Command configuration")
```

### any() / unknown()

```typescript
// 任意类型（不安全）
const anyVal = z.any()

// 未知类型（更安全，需要进一步验证）
const unknownVal = z.unknown()
```

**opencode 示例** - 来自 `src/session/message.ts`：

```typescript
metadata: z.record(z.string(), z.any()).optional()
```

---

## 验证与解析

### parse() - 解析并验证

```typescript
const schema = z.string()

// 成功时返回经过验证的值
const result = schema.parse("hello") // "hello"

// 失败时抛出 ZodError
schema.parse(123) // 抛出 ZodError
```

### safeParse() - 安全解析

不抛出异常，返回结果对象：

```typescript
const result = schema.safeParse("hello")

if (result.success) {
  console.log(result.data) // "hello"
} else {
  console.log(result.error) // ZodError
}
```

**opencode 示例** - 来自 `src/config/config.ts`：

```typescript
const parsed = Command.safeParse(config)
if (parsed.success) {
  result[config.name] = parsed.data
  continue
}
throw new InvalidError({ path: item, issues: parsed.error.issues }, { cause: parsed.error })
```

### parseAsync() / safeParseAsync()

用于包含异步验证（如 `.refine()` 异步函数）的 schema：

```typescript
const asyncSchema = z.string().refine(async (val) => {
  const exists = await checkIfExists(val)
  return exists
})

const result = await asyncSchema.parseAsync("test")
```

---

## 类型推断

### z.infer<> - 从 Schema 推断类型

这是 Zod 最强大的功能之一：

```typescript
const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email().optional(),
})

// 自动推断类型
type User = z.infer<typeof UserSchema>
// 等价于:
// type User = {
//   name: string;
//   age: number;
//   email?: string | undefined;
// }
```

**opencode 示例** - 这个模式在项目中随处可见：

```typescript
// src/session/message-v2.ts
export const TextPart = PartBase.extend({
  type: z.literal("text"),
  text: z.string(),
  // ...
}).meta({ ref: "TextPart" })

export type TextPart = z.infer<typeof TextPart>  // 类型推断
```

```typescript
// src/config/config.ts
export const PermissionAction = z.enum(["ask", "allow", "deny"])
export type PermissionAction = z.infer<typeof PermissionAction>  // "ask" | "allow" | "deny"
```

### z.input<> vs z.output<>

对于有 `.transform()` 或 `.default()` 的 schema：

```typescript
const schema = z.object({
  name: z.string().default("anonymous"),
  age: z.string().transform(Number),
})

type Input = z.input<typeof schema>
// { name?: string; age: string }

type Output = z.output<typeof schema>
// { name: string; age: number }

// z.infer 等同于 z.output
type Inferred = z.infer<typeof schema>
// { name: string; age: number }
```

**opencode 示例** - 来自 `src/config/config.ts`：

```typescript
export type Info = z.output<typeof Info>  // 使用 output 获取转换后的类型
```

---

## 自定义类型与验证

### custom() - 自定义类型

```typescript
// 创建一个自定义类型
const customType = z.custom<MyClass>((val) => val instanceof MyClass)
```

**opencode 示例** - 来自 `src/session/message.ts`：

```typescript
args: z.custom<Required<unknown>>()  // 自定义类型约束
```

**opencode 示例** - 来自 `src/session/index.ts`：

```typescript
export const getUsage = fn(
  z.object({
    model: z.custom<Provider.Model>(),  // 使用自定义 Provider.Model 类型
    usage: z.custom<LanguageModelUsage>(),
    metadata: z.custom<ProviderMetadata>().optional(),
  }),
  // ...
)
```

### refine() - 自定义验证

添加自定义验证逻辑：

```typescript
const positiveEven = z.number()
  .refine((n) => n > 0, { message: "Must be positive" })
  .refine((n) => n % 2 === 0, { message: "Must be even" })
```

**opencode 示例** - 来自 `src/config/config.ts` (LSP 配置验证)：

```typescript
lsp: z
  .union([
    z.literal(false),
    z.record(
      z.string(),
      z.union([
        z.object({ disabled: z.literal(true) }),
        z.object({
          command: z.array(z.string()),
          extensions: z.array(z.string()).optional(),
          disabled: z.boolean().optional(),
          env: z.record(z.string(), z.string()).optional(),
          initialization: z.record(z.string(), z.any()).optional(),
        }),
      ]),
    ),
  ])
  .optional()
  .refine(
    (data) => {
      if (!data) return true
      if (typeof data === "boolean") return true
      const serverIds = new Set(Object.values(LSPServer).map((s) => s.id))

      return Object.entries(data).every(([id, config]) => {
        if (config.disabled) return true
        if (serverIds.has(id)) return true
        return Boolean(config.extensions)  // 自定义 LSP 需要 extensions
      })
    },
    {
      error: "For custom LSP servers, 'extensions' array is required.",
    },
  )
```

### superRefine() - 更细粒度的验证

提供更多控制，包括添加多个错误：

```typescript
const schema = z.object({
  password: z.string(),
  confirmPassword: z.string(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords don't match",
      path: ["confirmPassword"],
    })
  }
})
```

---

## Schema 组合与扩展

### extend() - 扩展对象

```typescript
const Base = z.object({
  id: z.string(),
  createdAt: z.number(),
})

const User = Base.extend({
  name: z.string(),
  email: z.string().email(),
})
```

**opencode 示例** - 来自 `src/session/message-v2.ts`：

```typescript
// 基础 schema
const PartBase = z.object({
  id: z.string(),
  sessionID: z.string(),
  messageID: z.string(),
})

// 扩展创建不同类型的 Part
export const TextPart = PartBase.extend({
  type: z.literal("text"),
  text: z.string(),
  synthetic: z.boolean().optional(),
  // ...
})

export const ReasoningPart = PartBase.extend({
  type: z.literal("reasoning"),
  text: z.string(),
  // ...
})

export const FilePart = PartBase.extend({
  type: z.literal("file"),
  mime: z.string(),
  filename: z.string().optional(),
  url: z.string(),
  // ...
})
```

### merge() - 合并对象

```typescript
const A = z.object({ a: z.string() })
const B = z.object({ b: z.number() })
const AB = A.merge(B)
// { a: string; b: number }
```

### pick() / omit() - 选择或排除字段

```typescript
const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  password: z.string(),
})

// 只选择某些字段
const PublicUser = User.pick({ id: true, name: true })
// { id: string; name: string }

// 排除某些字段
const CreateUser = User.omit({ id: true })
// { name: string; email: string; password: string }
```

### partial() - 所有字段可选

```typescript
const User = z.object({
  name: z.string(),
  age: z.number(),
})

const PartialUser = User.partial()
// { name?: string; age?: number }

// 部分可选
const PartialName = User.partial({ name: true })
// { name?: string; age: number }
```

**opencode 示例** - 来自 `src/config/config.ts`：

```typescript
export const Provider = ModelsDev.Provider.partial()
  .extend({
    whitelist: z.array(z.string()).optional(),
    blacklist: z.array(z.string()).optional(),
    // ...
  })
```

### shape - 访问对象字段

```typescript
const User = z.object({
  name: z.string(),
  age: z.number(),
})

// 访问单个字段的 schema
const nameSchema = User.shape.name // z.ZodString
```

**opencode 示例** - 来自 `src/session/index.ts`：

```typescript
export const create = fn(
  z
    .object({
      parentID: Identifier.schema("session").optional(),
      title: z.string().optional(),
      permission: Info.shape.permission,  // 复用 Info 中的 permission 定义
    })
    .optional(),
  async (input) => { /* ... */ }
)
```

---

## 预处理与转换

### preprocess() - 预处理输入

在验证之前转换数据：

```typescript
const numberFromString = z.preprocess(
  (val) => (typeof val === "string" ? parseInt(val, 10) : val),
  z.number()
)

numberFromString.parse("42") // 42
numberFromString.parse(42) // 42
```

**opencode 示例** - 来自 `src/config/config.ts` (权限预处理)：

```typescript
const permissionPreprocess = (val: unknown) => {
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    return { __originalKeys: Object.keys(val), ...val }
  }
  return val
}

export const Permission = z
  .preprocess(
    permissionPreprocess,
    z.object({
      __originalKeys: z.string().array().optional(),
      read: PermissionRule.optional(),
      edit: PermissionRule.optional(),
      // ...
    }).catchall(PermissionRule).or(PermissionAction),
  )
  .transform(permissionTransform)
```

### transform() - 转换输出

在验证之后转换数据：

```typescript
const stringToNumber = z.string().transform((val) => parseInt(val, 10))

type Input = z.input<typeof stringToNumber> // string
type Output = z.output<typeof stringToNumber> // number

stringToNumber.parse("42") // 42
```

**opencode 示例** - 来自 `src/config/config.ts` (Agent 配置转换)：

```typescript
export const Agent = z
  .object({
    model: z.string().optional(),
    variant: z.string().optional(),
    temperature: z.number().optional(),
    // ... 其他字段
  })
  .catchall(z.any())
  .transform((agent, ctx) => {
    const knownKeys = new Set([
      "name", "model", "variant", "prompt", "description",
      // ... 其他已知键
    ])

    // 将未知属性提取到 options 中
    const options: Record<string, unknown> = { ...agent.options }
    for (const [key, value] of Object.entries(agent)) {
      if (!knownKeys.has(key)) options[key] = value
    }

    // 转换旧的 tools 配置为 permission
    const permission: Permission = {}
    for (const [tool, enabled] of Object.entries(agent.tools ?? {})) {
      const action = enabled ? "allow" : "deny"
      permission[tool] = action
    }

    return { ...agent, options, permission }
  })
```

---

## 元数据与 JSON Schema

### meta() - 添加元数据

为 schema 添加元数据（如用于 JSON Schema 生成）：

```typescript
const User = z.object({
  name: z.string(),
  age: z.number(),
}).meta({
  ref: "User",
  description: "A user object",
})
```

**opencode 示例** - 项目中广泛使用：

```typescript
// src/session/message-v2.ts
export const TextPart = PartBase.extend({
  type: z.literal("text"),
  text: z.string(),
}).meta({
  ref: "TextPart",  // 用于 JSON Schema 中的 $ref
})

// src/config/config.ts
export const PermissionAction = z.enum(["ask", "allow", "deny"]).meta({
  ref: "PermissionActionConfig",
})
```

这个模式使得可以生成干净的 JSON Schema，其中复杂类型被定义为可复用的引用。

---

## 实战模式

### 模式 1：Type 与 Schema 同名导出

这是 opencode 中最常见的模式：

```typescript
// 定义 Schema
export const Message = z.object({
  id: z.string(),
  content: z.string(),
  timestamp: z.number(),
}).meta({ ref: "Message" })

// 同名导出类型
export type Message = z.infer<typeof Message>

// 使用
function processMessage(msg: Message) {
  Message.parse(msg) // 运行时验证
}
```

### 模式 2：函数参数验证包装器

**opencode 示例** - 来自 `src/util/fn.ts`：

```typescript
import { z } from "zod"

export function fn<T extends z.ZodType, Result>(
  schema: T,
  cb: (input: z.infer<T>) => Result
) {
  const result = (input: z.infer<T>) => {
    const parsed = schema.parse(input)  // 运行时验证
    return cb(parsed)
  }
  result.force = (input: z.infer<T>) => cb(input)  // 跳过验证
  result.schema = schema
  return result
}
```

使用示例 - 来自 `src/session/index.ts`：

```typescript
export const create = fn(
  z
    .object({
      parentID: Identifier.schema("session").optional(),
      title: z.string().optional(),
      permission: Info.shape.permission,
    })
    .optional(),
  async (input) => {
    return createNext({
      parentID: input?.parentID,
      directory: Instance.directory,
      title: input?.title,
      permission: input?.permission,
    })
  },
)

// 调用时自动验证参数
await Session.create({ title: "My Session" })
```

### 模式 3：事件系统与类型安全

**opencode 示例** - 来自 `src/bus/bus-event.ts`：

```typescript
export namespace BusEvent {
  export function define<Type extends string, Properties extends ZodType>(
    type: Type,
    properties: Properties
  ) {
    const result = {
      type,
      properties,
    }
    registry.set(type, result)
    return result
  }

  export function payloads() {
    return z.discriminatedUnion(
      "type",
      registry.entries().map(([type, def]) =>
        z.object({
          type: z.literal(type),
          properties: def.properties,
        }).meta({ ref: "Event." + def.type })
      ).toArray() as any,
    ).meta({ ref: "Event" })
  }
}
```

使用 - 来自 `src/session/index.ts`：

```typescript
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

// 发布事件
Bus.publish(Event.Created, { info: result })
```

### 模式 4：命名错误（Named Errors）

**opencode 示例** - 来自 `src/session/message-v2.ts`：

```typescript
import { NamedError } from "@opencode-ai/util/error"

export const OutputLengthError = NamedError.create("MessageOutputLengthError", z.object({}))
export const AbortedError = NamedError.create("MessageAbortedError", z.object({ message: z.string() }))
export const AuthError = NamedError.create(
  "ProviderAuthError",
  z.object({
    providerID: z.string(),
    message: z.string(),
  }),
)
```

### 模式 5：配置文件验证

完整的配置验证模式 - 来自 `src/config/config.ts`：

```typescript
export const Info = z
  .object({
    $schema: z.string().optional().describe("JSON schema reference"),
    theme: z.string().optional().describe("Theme name"),
    keybinds: Keybinds.optional().describe("Custom keybinds"),
    logLevel: Log.Level.optional().describe("Log level"),
    // ... 许多配置选项
  })
  .strict()  // 不允许未知字段
  .meta({ ref: "Config" })

export type Info = z.output<typeof Info>

// 加载和验证
async function loadFile(filepath: string): Promise<Info> {
  let text = await Bun.file(filepath).text()
  // ... 预处理
  return load(text, filepath)
}
```

---

## 错误处理

### ZodError

当验证失败时，Zod 抛出 `ZodError`：

```typescript
try {
  schema.parse(invalidData)
} catch (e) {
  if (e instanceof z.ZodError) {
    console.log(e.issues)  // 错误详情数组
    console.log(e.format())  // 格式化的错误对象
    console.log(e.flatten())  // 扁平化的错误
  }
}
```

### 错误类型

```typescript
const result = z.string().safeParse(123)
if (!result.success) {
  result.error.issues.forEach(issue => {
    console.log(issue.code)     // "invalid_type"
    console.log(issue.message)  // "Expected string, received number"
    console.log(issue.path)     // [] (路径)
  })
}
```

### 自定义错误消息

```typescript
const schema = z.string({
  required_error: "Name is required",
  invalid_type_error: "Name must be a string",
}).min(3, { message: "Name must be at least 3 characters" })
```

**opencode 示例** - 来自 `src/tool/tool.ts`：

```typescript
try {
  toolInfo.parameters.parse(args)
} catch (error) {
  if (error instanceof z.ZodError && toolInfo.formatValidationError) {
    throw new Error(toolInfo.formatValidationError(error), { cause: error })
  }
  throw new Error(
    `The ${id} tool was called with invalid arguments: ${error}.\nPlease rewrite the input so it satisfies the expected schema.`,
    { cause: error },
  )
}
```

---

## 最佳实践

### 1. 总是导出 Schema 和 Type

```typescript
// ✅ 好的做法
export const User = z.object({ ... })
export type User = z.infer<typeof User>

// ❌ 不推荐：只导出类型
export type User = { name: string }
```

### 2. 使用 meta() 为 JSON Schema 生成做准备

```typescript
export const Config = z.object({
  // ...
}).meta({ ref: "Config" })
```

### 3. 使用 describe() 添加文档

```typescript
port: z.number()
  .int()
  .positive()
  .optional()
  .describe("Port to listen on (default: 3000)")
```

### 4. 对于复杂对象使用 extend() 而不是 merge()

```typescript
// ✅ 更清晰的继承关系
const Extended = Base.extend({
  newField: z.string()
})
```

### 5. 使用判别联合而不是普通联合

```typescript
// ✅ 更好的性能和错误信息
z.discriminatedUnion("type", [
  z.object({ type: z.literal("a"), ... }),
  z.object({ type: z.literal("b"), ... }),
])

// ❌ 性能较差
z.union([
  z.object({ type: z.literal("a"), ... }),
  z.object({ type: z.literal("b"), ... }),
])
```

### 6. 使用 safeParse() 处理不可信输入

```typescript
const result = Schema.safeParse(userInput)
if (!result.success) {
  // 优雅处理错误
  return { error: result.error.format() }
}
return { data: result.data }
```

### 7. 复用 Schema 片段

```typescript
// 定义可复用的片段
const Timestamps = z.object({
  createdAt: z.number(),
  updatedAt: z.number(),
})

// 复用
const User = z.object({
  name: z.string(),
}).merge(Timestamps)

const Post = z.object({
  title: z.string(),
}).merge(Timestamps)
```

### 8. 使用 strict() 防止意外字段

对于配置文件等关键数据：

```typescript
const ConfigSchema = z.object({
  port: z.number(),
  host: z.string(),
}).strict()  // 拒绝任何额外字段
```

---

## 总结

Zod 是 TypeScript 项目中进行运行时数据验证的首选库。本指南覆盖了 opencode 项目中使用的主要特性：

| 特性 | 描述 | 常见用例 |
|------|------|----------|
| 基础类型 | `z.string()`, `z.number()`, `z.boolean()` | 参数验证 |
| 对象 | `z.object({...})` | 配置、消息结构 |
| 判别联合 | `z.discriminatedUnion()` | 多态类型 |
| 枚举 | `z.enum([...])` | 状态、模式选项 |
| 类型推断 | `z.infer<typeof Schema>` | 类型安全 |
| 验证 | `.parse()`, `.safeParse()` | 运行时验证 |
| 转换 | `.transform()`, `.preprocess()` | 数据处理 |
| 元数据 | `.meta()`, `.describe()` | 文档、架构生成 |
| Schema 组合 | `.extend()`, `.merge()`, `.pick()` | 代码复用 |

通过在整个项目中一致使用 Zod，opencode 实现了：
- 运行时类型安全
- 自文档化的代码
- 清晰的验证错误
- 可维护的类型定义

---

## 参考资源

- [Zod 官方文档](https://zod.dev)
- [Zod GitHub 仓库](https://github.com/colinhacks/zod)
- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
