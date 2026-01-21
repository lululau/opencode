# Slack 集成详解

## 目录

1. [Slack 集成概述](#slack-集成概述)
2. [架构设计](#架构设计)
3. [Slack Bot 设置](#slack-bot-设置)
4. [消息处理](#消息处理)
5. [命令执行](#命令执行)
6. [文件上传](#文件上传)
7. [通知系统](#通知系统)
8. [配置与部署](#配置与部署)
9. [API 集成](#api-集成)
10. [事件系统](#事件系统)
11. [最佳实践](#最佳实践)

---

## Slack 集成概述

OpenCode 提供完整的 Slack 集成，允许开发者在 Slack 频道和线程中直接与 AI 代理交互。每个 Slack 线程都会创建独立的 OpenCode 会话，实现持续的对话上下文。

### 核心功能

- **线程会话管理**：每个 Slack 线程对应独立的 OpenCode 会话
- **实时响应**：通过 Socket Mode 实现实时双向通信
- **工具执行通知**：AI 工具执行状态实时反馈到 Slack
- **会话共享**：支持生成会话分享链接
- **命令支持**：支持斜杠命令和自定义指令
- **文件处理**：支持上传和引用 Slack 文件
- **多频道支持**：可在多个频道同时运行

### 技术栈

| 组件             | 技术                                   | 版本      |
| ---------------- | -------------------------------------- | --------- |
| **Slack SDK**    | `@slack/bolt`                          | ^3.17.1   |
| **OpenCode SDK** | `@opencode-ai/sdk`                     | latest    |
| **通信模式**     | Socket Mode                            | WebSocket |
| **认证方式**     | Bot Token + Signing Secret + App Token | OAuth 2.0 |

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Slack Workspace                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  │  Channel    │  │  Channel    │  │  DM Thread │
│  │  Messages   │  │  Thread     │  │  Messages   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
│         │                  │                  │
└─────────┼──────────────────┼──────────────────┘
          │                  │
    ┌─────┴──────────────────┴─────┐
    │    Slack API (Socket Mode)    │
    │    WebSocket Connection       │
    └─────┬──────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│              @opencode-ai/slack Package                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  │ Event       │  │ Session     │  │ Message     │
│  │ Handler     │  │ Manager     │  │ Router      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
│         │                  │                  │
└─────────┼──────────────────┼──────────────────┘
          │                  │
          ▼                  ▼
    ┌─────────┐       ┌──────────┐
    │ Slack   │       │ OpenCode│
    │ Bolt    │       │  Server  │
    │ App     │       │          │
    └────┬────┘       └────┬─────┘
         │                │
         └────────┬───────┘
                  ▼
          ┌────────────────┐
          │ Session Map   │
          │ channel:thread│
          └────────────────┘
```

### 核心组件

| 组件                | 位置                          | 职责                                  |
| ------------------- | ----------------------------- | ------------------------------------- |
| **Slack App**       | `packages/slack/src/index.ts` | Slack Bot 主应用和事件处理            |
| **Session Manager** | `packages/slack/src/index.ts` | 管理 Slack 线程到 OpenCode 会话的映射 |
| **Tool Handler**    | `packages/slack/src/index.ts` | 处理 AI 工具执行更新                  |
| **OpenCode SDK**    | `@opencode-ai/sdk`            | 与 OpenCode 服务器通信                |

### 数据流

```
Slack Message (User)
    ↓
Slack Event (WebSocket)
    ↓
Slack Bolt App (event handler)
    ↓
Check Thread Context
    ↓
Create/Resume OpenCode Session
    ↓
Send Prompt to OpenCode
    ↓
AI Processing
    ↓
Tool Execution Events (stream)
    ↓
Post Tool Updates to Slack Thread
    ↓
Post Final Response to Slack Thread
```

---

## Slack Bot 设置

### 创建 Slack 应用

1. **访问 Slack App 管理页面**

   访问 https://api.slack.com/apps 并点击 "Create New App"

2. **配置应用基本信息**
   - App Name: `OpenCode Bot` (或自定义名称)
   - Development Slack Workspace: 选择你的工作区

3. **启用 Socket Mode**

   在左侧菜单选择 "Socket Mode"：
   - 启用 "Socket Mode"
   - 保存设置

4. **配置 OAuth 权限**

   在左侧菜单选择 "OAuth & Permissions"：
   - **Bot Token Scopes** 添加以下权限：
     - `chat:write` - 发送消息
     - `app_mentions:read` - 读取提及
     - `channels:history` - 读取频道历史
     - `groups:history` - 读取私有频道历史

5. **安装应用到工作区**
   - 滚动到页面顶部，点击 "Install to Workspace"
   - 授权应用访问你的工作区
   - 复制生成的 **Bot User OAuth Token**

6. **创建 App-Level Token**
   - 在左侧菜单选择 "Basic Information"
   - 滚动到 "App-Level Tokens"
   - 点击 "Generate Token and Scopes"
   - 名称: `connection-token`
   - Scope: `connections:write`
   - 生成并复制 **App-Level Token**

7. **获取 Signing Secret**
   - 在 "Basic Information" 页面
   - 滚动到 "App Credentials"
   - 复制 **Signing Secret**

### 环境变量配置

创建 `.env` 文件（或通过 CI/CD 配置）：

```bash
# Slack Bot Token (xoxb-*)
SLACK_BOT_TOKEN=......................................................

# Slack Signing Secret
SLACK_SIGNING_SECRET=................................................................

# Slack App-Level Token (xapp-*)
SLACK_APP_TOKEN=.............................................
```

### 权限说明

| 权限                | 用途             | 必需 |
| ------------------- | ---------------- | ---- |
| `chat:write`        | 在频道中发送消息 | ✅   |
| `app_mentions:read` | 读取 @提及       | ✅   |
| `channels:history`  | 读取公共频道历史 | ✅   |
| `groups:history`    | 读取私有频道历史 | 🟡   |
| `files:write`       | 上传文件         | 🟡   |
| `links:write`       | 发送链接预览     | ❌   |

### Bot 添加到频道

```bash
# 方式 1：通过 Slack UI
# 1. 打开应用设置
# 2. 选择 "Install to Workspace"
# 3. 在 Slack 中搜索 Bot 名称
# 4. 点击 "Add to channel"

# 方式 2：通过命令
/invite @OpenCode Bot

# 方式 3：通过 API
curl -X POST \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  https://slack.com/api/conversations.join \
  -d '{"channel": "C1234567890"}'
```

---

## 消息处理

### 消息路由

```typescript
// packages/slack/src/index.ts
app.message(async ({ message, say }) => {
  // 1. 验证消息
  if (message.subtype || !("text" in message) || !message.text) {
    console.log("⏭️ Skipping message - no text or has subtype")
    return
  }

  // 2. 提取上下文
  const channel = message.channel
  const thread = (message as any).thread_ts || message.ts
  const sessionKey = `${channel}-${thread}`

  // 3. 查找或创建会话
  let session = sessions.get(sessionKey)

  if (!session) {
    // 创建新会话
    session = await createNewSession(channel, thread)
    sessions.set(sessionKey, session)
  }

  // 4. 发送到 OpenCode
  await sendToOpenCode(session, message.text)

  // 5. 发送响应到 Slack
  await postResponse(say, session)
})
```

### 会话管理

每个 Slack 线程映射到独立的 OpenCode 会话：

```typescript
// packages/slack/src/index.ts
const sessions = new Map<
  string,
  {
    client: any
    server: any
    sessionId: string
    channel: string
    thread: string
  }
>()

async function createNewSession(channel: string, thread: string) {
  console.log("🆕 Creating new opencode session...")

  const { client, server } = opencode

  // 创建 OpenCode 会话
  const createResult = await client.session.create({
    body: { title: `Slack thread ${thread}` },
  })

  if (createResult.error) {
    throw new Error(`Failed to create session: ${createResult.error}`)
  }

  console.log("✅ Created opencode session:", createResult.data.id)

  // 构建会话对象
  const session = {
    client,
    server,
    sessionId: createResult.data.id,
    channel,
    thread,
  }

  // 生成分享链接
  const shareResult = await client.session.share({
    path: { id: createResult.data.id },
  })

  if (!shareResult.error && shareResult.data) {
    const sessionUrl = shareResult.data.share?.url!
    console.log("🔗 Session shared:", sessionUrl)

    // 发布分享链接
    await app.client.chat.postMessage({
      channel,
      thread_ts: thread,
      text: sessionUrl,
    })
  }

  return session
}
```

### 消息格式化

OpenCode 响应会自动格式化为 Slack 兼容格式：

```typescript
// packages/slack/src/index.ts
function formatResponse(response: any): string {
  // 优先使用 info.content
  if (response.info?.content) {
    return response.info.content
  }

  // 提取所有文本部分
  const textParts = response.parts
    ?.filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("\n")

  return textParts || "I received your message but didn't have a response."
}

// 工具更新消息
function formatToolUpdate(part: ToolPart): string {
  return `*${part.tool}* - ${part.state.title}`
}
```

### 线程 vs 频道

| 类型         | 会话映射                   | 用途         |
| ------------ | -------------------------- | ------------ |
| **频道消息** | `channel-messageTimestamp` | 独立话题讨论 |
| **线程回复** | `channel-threadTimestamp`  | 持续同一话题 |
| **私信**     | `dm-messageTimestamp`      | 私密对话     |

**线程消息示例**：

```
# Slack UI
┌─────────────────────────────────┐
│ User: Help me fix this bug    │
│ OpenCode Bot: Sure, let me...  │ ← 线程开始
│   ├── 📍 *read_file*         │ ← 工具更新
│   ├── 📍 *bash*              │ ← 工具更新
│   └── Here's the fix...       │ ← 最终响应
│ User: Thanks!                  │ ← 线程继续
│ OpenCode Bot: You're welcome!   │
└─────────────────────────────────┘
```

---

## 命令执行

### 斜杠命令

OpenCode Slack Bot 支持斜杠命令：

#### `/test` 命令

```typescript
// packages/slack/src/index.ts
app.command("/test", async ({ command, ack, say }) => {
  await ack()
  console.log("🧪 Test command received:", JSON.stringify(command, null, 2))

  await say("🤖 Bot is working! I can hear you loud and clear.")
})
```

**使用示例**：

```bash
# 在 Slack 中输入
/test

# Bot 响应
🤖 Bot is working! I can hear you loud and clear.
```

#### 自定义命令

```typescript
// 添加自定义命令
app.command("/summarize", async ({ command, ack, say }) => {
  await ack()

  // 获取最近的代码变更
  const changes = await getRecentChanges()

  // 使用 OpenCode 生成摘要
  const summary = await generateSummary(changes)

  await say(summary)
})

app.command("/review", async ({ command, ack, say }) => {
  await ack()

  // 获取 PR 或代码
  const prUrl = command.text

  // 使用 OpenCode 审查代码
  const review = await reviewCode(prUrl)

  await say(formatReview(review))
})
```

### 命令权限

在 Slack App 管理页面配置命令权限：

1. **导航到** "Slash Commands"
2. **点击** "Create New Command"
3. **配置**：
   - Command: `/your-command`
   - Request URL: 不需要（Socket Mode）
   - Short Description: 命令描述
   - Usage Hint: 使用提示

### AI 命令解释

OpenCode 可以理解自然语言命令：

| 用户输入                    | AI 理解      | 执行               |
| --------------------------- | ------------ | ------------------ |
| `fix this bug`              | 需要修复 Bug | 分析问题，生成代码 |
| `explain this code`         | 需要解释     | 分析代码，提供说明 |
| `write tests for this`      | 需要测试     | 生成测试用例       |
| `refactor this function`    | 需要重构     | 改进代码结构       |
| `deploy this to production` | 需要部署     | 执行部署流程       |

---

## 文件上传

### Slack 文件引用

OpenCode 可以读取和引用 Slack 中上传的文件：

```typescript
app.message(async ({ message, say, client }) => {
  // 检查消息中是否包含文件
  if ("files" in message && message.files) {
    for (const file of message.files) {
      // 下载文件
      const fileData = await client.files.info({
        file: file.id,
      })

      // 提取文件内容
      const content = await extractFileContent(fileData)

      // 发送到 OpenCode
      await sendToOpenCode(session, {
        type: "file",
        filename: file.name,
        content: content,
      })
    }
  }

  // 处理文本消息
  if (message.text) {
    await sendToOpenCode(session, message.text)
  }
})
```

### 支持的文件类型

| 类型          | MIME 类型          | 处理方式            |
| ------------- | ------------------ | ------------------- |
| **代码文件**  | `text/*`           | 直接读取内容        |
| **图片**      | `image/*`          | 使用 OCR 或视觉分析 |
| **PDF**       | `application/pdf`  | 提取文本内容        |
| **JSON/YAML** | `application/json` | 解析为对象          |
| **压缩包**    | `application/zip`  | 解压并处理          |

### 文件大小限制

| 类型          | 限制 | 说明          |
| ------------- | ---- | ------------- |
| **免费层**    | 1GB  | 单个文件      |
| **付费层**    | 1GB  | 单个文件      |
| **Slack Bot** | 1GB  | 通过 API 上传 |

### 示例：代码审查

```bash
# Slack 中上传代码文件并@提及 Bot
@OpenCode Bot Please review this code

# OpenCode 处理流程
1. 接收文件引用
2. 下载文件内容
3. 分析代码
4. 生成审查报告
5. 在线程中发布审查结果
```

### 示例：日志分析

```bash
# 上传日志文件
@OpenCode Bot Analyze this error log

# OpenCode 响应
## Error Analysis

### Summary
Found 3 critical errors:

1. **Connection timeout** (line 45)
   - Frequency: 12 times
   - Root cause: Network latency

2. **Authentication failure** (line 89)
   - Frequency: 5 times
   - Root cause: Expired token

3. **Memory overflow** (line 134)
   - Frequency: 1 time
   - Root cause: Memory leak

### Recommendations
- Implement retry logic with exponential backoff
- Add token refresh mechanism
- Profile memory usage
```

---

## 通知系统

### 工具执行通知

OpenCode 实时推送工具执行状态到 Slack：

```typescript
// packages/slack/src/index.ts
;(async () => {
  const events = await opencode.client.event.subscribe()

  for await (const event of events.stream) {
    if (event.type === "message.part.updated") {
      const part = event.properties.part

      // 处理工具更新
      if (part.type === "tool") {
        await handleToolUpdate(part)
      }
    }
  }
})()

async function handleToolUpdate(part: ToolPart) {
  // 只在工具完成时通知
  if (part.state.status !== "completed") return

  // 构建工具消息
  const toolMessage = `*${part.tool}* - ${part.state.title}`

  // 查找对应的 Slack 会话
  for (const [sessionKey, session] of sessions.entries()) {
    if (session.sessionId === part.sessionID) {
      // 发布工具更新到线程
      await app.client.chat.postMessage({
        channel: session.channel,
        thread_ts: session.thread,
        text: toolMessage,
      })
      break
    }
  }
}
```

### 通知状态

| 状态            | 图标 | 说明         |
| --------------- | ---- | ------------ |
| **in_progress** | 🔄   | 工具正在执行 |
| **completed**   | ✅   | 工具执行成功 |
| **failed**      | ❌   | 工具执行失败 |
| **cancelled**   | ⏭️   | 工具被取消   |

### 示例通知流

```
User: Fix the login bug

OpenCode Bot: Let me analyze the issue...

├── 🔄 *read_file* - Reading authentication code
├── 🔄 *bash* - Running tests
├── ✅ *bash* - Tests passed
├── 🔄 *edit* - Fixing authentication flow
├── ✅ *edit* - Changes applied
└── 🔄 *bash* - Running final tests

OpenCode Bot: Bug fixed! The issue was caused by...

[Code diff shown here]

The fix has been committed. Run `git pull` to get the changes.
```

### 进度通知

对于长时间运行的任务，OpenCode 会推送进度更新：

```typescript
async function reportProgress(sessionId: string, progress: number, message: string) {
  const session = findSession(sessionId)

  await app.client.chat.postMessage({
    channel: session.channel,
    thread_ts: session.thread,
    text: `Progress: ${progress}% - ${message}`,
  })
}

// 使用示例
await reportProgress(sessionId, 25, "Analyzing code...")
await reportProgress(sessionId, 50, "Generating fixes...")
await reportProgress(sessionId, 75, "Running tests...")
await reportProgress(sessionId, 100, "Complete!")
```

### 错误通知

```typescript
async function reportError(sessionId: string, error: Error) {
  const session = findSession(sessionId)

  await app.client.chat.postMessage({
    channel: session.channel,
    thread_ts: session.thread,
    text: `❌ Error: ${error.message}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Error occurred:* ${error.message}\n\n\`\`\`${error.stack}\`\`\``,
        },
      },
    ],
  })
}
```

---

## 配置与部署

### 开发环境配置

```bash
# 1. 安装依赖
cd packages/slack
bun install

# 2. 创建 .env 文件
cp .env.example .env

# 3. 编辑 .env
nano .env

# 4. 运行开发服务器
bun run dev
```

### 生产环境部署

#### 方式 1：Docker

```dockerfile
# Dockerfile
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY . .

ENV SLACK_BOT_TOKEN=""
ENV SLACK_SIGNING_SECRET=""
ENV SLACK_APP_TOKEN=""

CMD ["bun", "run", "src/index.ts"]
```

```yaml
# docker-compose.yml
version: "3.8"

services:
  opencode-slack:
    build: .
    environment:
      SLACK_BOT_TOKEN: ${SLACK_BOT_TOKEN}
      SLACK_SIGNING_SECRET: ${SLACK_SIGNING_SECRET}
      SLACK_APP_TOKEN: ${SLACK_APP_TOKEN}
    restart: unless-stopped
```

#### 方式 2：Serverless (AWS Lambda)

```typescript
// index.ts (Lambda handler)
import { Handler } from "aws-lambda"
import { createServer } from "http-server"

const server = createServer((req, res) => {
  // 处理 Slack events
})

export const handler: Handler = async (event) => {
  return server(event, {})
}
```

```yaml
# serverless.yml
service: opencode-slack

functions:
  slackBot:
    handler: index.handler
    events:
      - http:
          path: slack/events
          method: post
    environment:
      SLACK_BOT_TOKEN: ${env:SLACK_BOT_TOKEN}
      SLACK_SIGNING_SECRET: ${env:SLACK_SIGNING_SECRET}
      SLACK_APP_TOKEN: ${env:SLACK_APP_TOKEN}
```

#### 方式 3：PaaS (Railway/Render)

```bash
# 部署到 Railway
railway up

# 部署到 Render
render deploy
```

### 环境变量管理

#### 开发环境

```bash
# .env (Git 忽略)
SLACK_BOT_TOKEN=xoxb-*
SLACK_SIGNING_SECRET=*
SLACK_APP_TOKEN=xapp-*
```

#### 生产环境

```bash
# 通过平台配置环境变量
# Railway / Render / AWS Lambda
```

#### CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy-slack.yml
name: Deploy Slack Bot

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: awslabs/amazon-ecr-login@v2

      - name: Build and push
        run: |
          docker build -t opencode-slack .
          docker push $ECR_REGISTRY/opencode-slack

      - name: Deploy
        run: |
          # 更新 Lambda 函数
          aws lambda update-function-code \
            --function-name opencode-slack \
            --zip-file fileb://function.zip
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

---

## API 集成

### OpenCode SDK 集成

```typescript
// packages/slack/src/index.ts
import { createOpencode, type ToolPart } from "@opencode-ai/sdk"

// 创建 OpenCode 服务器
const opencode = await createOpencode({
  port: 0, // 使用随机端口
})

// 获取客户端和服务器实例
const { client, server } = opencode
```

### 订阅事件流

```typescript
// 订阅 OpenCode 事件
const events = await opencode.client.event.subscribe()

for await (const event of events.stream) {
  switch (event.type) {
    case "message.part.updated":
      await handleMessagePartUpdated(event)
      break
    case "session.created":
      await handleSessionCreated(event)
      break
    case "session.deleted":
      await handleSessionDeleted(event)
      break
  }
}
```

### 会话操作

#### 创建会话

```typescript
const createResult = await client.session.create({
  body: {
    title: "Slack thread",
    metadata: {
      channel: "C1234567890",
      thread: "1234567890.123456",
    },
  },
})

if (createResult.error) {
  console.error("Failed to create session:", createResult.error)
  throw new Error("Session creation failed")
}

const sessionId = createResult.data.id
```

#### 发送消息

```typescript
const promptResult = await client.session.prompt({
  path: { id: sessionId },
  body: {
    parts: [
      {
        type: "text",
        text: "Help me write a function to sort an array",
      },
    ],
  },
})

if (promptResult.error) {
  console.error("Failed to send prompt:", promptResult.error)
  throw new Error("Prompt failed")
}

const response = promptResult.data
```

#### 分享会话

```typescript
const shareResult = await client.session.share({
  path: { id: sessionId },
})

if (!shareResult.error && shareResult.data) {
  const sessionUrl = shareResult.data.share?.url
  console.log("Session URL:", sessionUrl)

  // 发布到 Slack
  await app.client.chat.postMessage({
    channel,
    thread_ts: thread,
    text: `View this session: ${sessionUrl}`,
  })
}
```

### 工具执行监控

```typescript
type ToolPart = {
  type: "tool"
  tool: string
  sessionID: string
  state: {
    status: "in_progress" | "completed" | "failed" | "cancelled"
    title: string
  }
}

async function monitorTools(sessionId: string) {
  for await (const event of events.stream) {
    if (event.type === "message.part.updated") {
      const part = event.properties.part as ToolPart

      if (part.type === "tool" && part.sessionID === sessionId) {
        await handleToolUpdate(part)

        // 如果工具完成，停止监控
        if (part.state.status === "completed" || part.state.status === "failed" || part.state.status === "cancelled") {
          break
        }
      }
    }
  }
}
```

---

## 事件系统

### Slack 事件类型

OpenCode 处理以下 Slack 事件：

| 事件          | 触发条件         | 处理方式        |
| ------------- | ---------------- | --------------- |
| `message`     | 用户发送消息     | 发送到 OpenCode |
| `command`     | 用户使用斜杠命令 | 执行命令        |
| `file_shared` | 用户分享文件     | 读取并处理文件  |
| `app_mention` | 用户 @提及 Bot   | 响应提及        |

### 事件中间件

```typescript
// packages/slack/src/index.ts
app.use(async ({ next, context }) => {
  console.log("📡 Raw Slack event:", JSON.stringify(context, null, 2))

  // 添加自定义逻辑
  if (shouldSkipEvent(context)) {
    return
  }

  // 继续处理
  await next()
})

function shouldSkipEvent(context: any): boolean {
  // 忽略机器人自己的消息
  if (context.message?.bot_id) return true

  // 忽略特定消息类型
  if (context.message?.subtype === "bot_message") return true

  return false
}
```

### OpenCode 事件类型

| 事件                   | 说明           | 用途         |
| ---------------------- | -------------- | ------------ |
| `message.part.updated` | 消息部分更新   | 工具执行状态 |
| `session.created`      | 会话创建       | 初始化       |
| `session.deleted`      | 会话删除       | 清理         |
| `agent.started`        | Agent 开始执行 | 通知         |
| `agent.completed`      | Agent 完成执行 | 结果         |

---

## 最佳实践

### 消息设计

1. **清晰明确**：使用简短、清晰的消息
2. **提供上下文**：必要时提供相关代码或日志
3. **分步进行**：复杂任务分解为多轮对话
4. **验证结果**：检查 AI 生成的代码和结果

**示例**：

```
❌ 模糊: fix it
✅ 清晰: The login button throws an error when clicked

❌ 缺少上下文: what's wrong here?
✅ 提供上下文: The user authentication fails with this error:
   Error: Invalid redirect URI
   at line 45 of auth.ts
```

### 会话管理

1. **线程对话**：使用线程保持对话上下文
2. **定期清理**：不活跃会话自动清理
3. **资源限制**：限制每个工作区的最大会话数
4. **错误恢复**：处理会话创建失败

```typescript
// 会话清理
setInterval(
  () => {
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 小时

    for (const [key, session] of sessions.entries()) {
      if (now - session.createdAt > maxAge) {
        sessions.delete(key)

        // 清理 OpenCode 会话
        await session.client.session.delete({
          path: { id: session.sessionId },
        })
      }
    }
  },
  60 * 60 * 1000,
) // 每小时清理
```

### 安全实践

1. **验证签名**：验证所有 Slack Webhook 请求
2. **权限最小化**：只授予必要的权限
3. **敏感数据**：不在日志中记录敏感信息
4. **访问控制**：限制 Bot 可访问的频道

```typescript
import { verifyRequestSignature } from "@slack/bolt"

app.use(async ({ next, context }) => {
  // 验证签名
  const isValid = await verifyRequestSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    body: context.rawBody,
    headers: context.headers,
  })

  if (!isValid) {
    console.error("Invalid signature")
    return
  }

  await next()
})
```

### 性能优化

1. **异步处理**：长时间任务异步执行
2. **并发控制**：限制并发会话数
3. **缓存响应**：缓存常见查询结果
4. **错误重试**：实现指数退避重试

```typescript
// 并发控制
const MAX_CONCURRENT_SESSIONS = 10
const activeSessions = new Set<string>()

async function processMessage(sessionId: string) {
  // 等待可用槽位
  while (activeSessions.size >= MAX_CONCURRENT_SESSIONS) {
    await Bun.sleep(100)
  }

  activeSessions.add(sessionId)

  try {
    // 处理消息
    await sendToOpenCode(sessionId)
  } finally {
    activeSessions.delete(sessionId)
  }
}
```

### 错误处理

```typescript
app.message(async ({ message, say }) => {
  try {
    await processMessage(message)
  } catch (error) {
    console.error("Error processing message:", error)

    // 友好的错误消息
    await say({
      text: "Sorry, I encountered an error. Please try again later.",
      thread_ts: (message as any).thread_ts || message.ts,
    })

    // 记录错误到监控
    await logErrorToMonitoring(error)
  }
})
```

### 故障排除

| 问题           | 原因                  | 解决方案                |
| -------------- | --------------------- | ----------------------- |
| Bot 不响应     | Socket Mode 未启用    | 启用 Socket Mode        |
| 机器人权限错误 | 权限未配置            | 添加必要的 OAuth scopes |
| 会话创建失败   | OpenCode 服务器不可达 | 检查服务器状态          |
| 消息延迟       | 网络问题              | 检查网络连接            |
| 文件无法读取   | 文件类型不支持        | 转换为支持的格式        |

---

## 参考资源

- **Slack API 文档**：https://api.slack.com/
- **Bolt 框架**：https://slack.dev/bolt-js/
- **OpenCode SDK**：https://opencode.ai/docs/sdk/
- **Socket Mode 指南**：https://api.slack.com/apis/connections/socket-mode
- **Slack 应用配置**：https://api.slack.com/apps

---

_文档版本：1.0.0_
_最后更新：2026-01-22_
