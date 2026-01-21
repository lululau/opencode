# API 参考

## 目录

1. [概述](#概述)
2. [认证方式](#认证方式)
3. [会话管理 API](#会话管理-api)
4. [配置管理 API](#配置管理-api)
5. [文件操作 API](#文件操作-api)
6. [项目 API](#项目-api)
7. [提供商 API](#提供商-api)
8. [权限 API](#权限-api)
9. [MCP API](#mcp-api)
10. [全局 API](#全局-api)
11. [错误响应](#错误响应)
12. [速率限制](#速率限制)

---

## 概述

OpenCode 提供了一套完整的 REST API，用于管理和控制 OpenCode 服务器的各项功能。所有 API 端点都遵循 OpenAPI 3.0 规范，可通过以下方式访问：

- **基础 URL**: `http://localhost:port/api`（本地开发）
- **内容类型**: `application/json`
- **字符编码**: UTF-8

**API 版本**: 当前版本为 v1，所有端点无需在路径中指定版本号。

### OpenAPI 规范

完整的 OpenAPI 规范文档可从以下地址获取：

```
https://raw.githubusercontent.com/anomalyco/opencode/refs/heads/dev/packages/sdk/openapi.json
```

---

## 认证方式

OpenCode API 使用以下认证方式：

### 1. 本地开发认证

在本地开发环境中，API 默认无需认证，可直接访问：

```bash
curl http://localhost:3000/api/session
```

### 2. 生产环境认证

在生产环境中，API 使用以下认证方式：

#### API Key 认证

在请求头中包含 API Key：

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://api.opencode.ai/api/session
```

#### OAuth 认证

某些操作（如 Provider OAuth、MCP OAuth）使用 OAuth 流程：

1. **获取授权 URL**: 调用 OAuth 端点获取授权 URL
2. **用户授权**: 在浏览器中打开授权 URL 并完成授权
3. **交换令牌**: 使用授权码获取访问令牌
4. **使用令牌**: 在后续请求中使用访问令牌

**相关文档**:

- [10-认证与授权.md](./10-认证与授权.md) - 详细认证机制

---

## 会话管理 API

会话管理 API 提供创建、查询、更新、删除和管理 OpenCode 会话的功能。

### 列出会话

**端点**: `GET /api/session`

**描述**: 获取所有 OpenCode 会话列表，按最近更新时间排序。

**查询参数**:

| 参数        | 类型    | 必需 | 描述                                   |
| ----------- | ------- | ---- | -------------------------------------- |
| `directory` | string  | 否   | 按项目目录过滤会话                     |
| `roots`     | boolean | 否   | 仅返回根会话（无 parentID）            |
| `start`     | number  | 否   | 仅返回在此时间戳之后更新的会话（毫秒） |
| `search`    | string  | 否   | 按标题过滤会话（不区分大小写）         |
| `limit`     | number  | 否   | 返回的最大会话数                       |

**响应**:

```json
[
  {
    "sessionID": "ses_abc123",
    "title": "实现新功能",
    "directory": "/path/to/project",
    "created": 1737528347000,
    "updated": 1737532000000,
    "parentID": "ses_def456",
    "archived": null
  }
]
```

**示例**:

```bash
# 获取所有会话
curl http://localhost:3000/api/session

# 获取特定目录的会话
curl "http://localhost:3000/api/session?directory=/path/to/project"

# 获取根会话（无父会话）
curl "http://localhost:3000/api/session?roots=true"

# 搜索会话
curl "http://localhost:3000/api/session?search=实现"

# 获取最近10个会话
curl "http://localhost:3000/api/session?limit=10"
```

---

### 获取会话状态

**端点**: `GET /api/session/status`

**描述**: 获取所有会话的当前状态，包括活跃、空闲和已完成状态。

**响应**:

```json
{
  "ses_abc123": {
    "status": "idle",
    "active": false,
    "messageCount": 15,
    "lastActivity": 1737532000000
  },
  "ses_def456": {
    "status": "active",
    "active": true,
    "messageCount": 23,
    "lastActivity": 1737532500000
  }
}
```

---

### 获取单个会话

**端点**: `GET /api/session/:sessionID`

**描述**: 获取特定 OpenCode 会话的详细信息。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**响应**:

```json
{
  "sessionID": "ses_abc123",
  "title": "实现新功能",
  "directory": "/path/to/project",
  "created": 1737528347000,
  "updated": 1737532000000,
  "parentID": "ses_def456",
  "archived": null
}
```

**示例**:

```bash
curl http://localhost:3000/api/session/ses_abc123
```

---

### 获取会话子会话

**端点**: `GET /api/session/:sessionID/children`

**描述**: 获取从指定父会话 fork 出来的所有子会话。

**路径参数**:

| 参数        | 类型   | 必需 | 描述      |
| ----------- | ------ | ---- | --------- |
| `sessionID` | string | 是   | 父会话 ID |

**响应**:

```json
[
  {
    "sessionID": "ses_child1",
    "title": "子会话 1",
    "directory": "/path/to/project",
    "created": 1737532000000,
    "updated": 1737532500000,
    "parentID": "ses_abc123",
    "archived": null
  },
  {
    "sessionID": "ses_child2",
    "title": "子会话 2",
    "directory": "/path/to/project",
    "created": 1737532100000,
    "updated": 1737532600000,
    "parentID": "ses_abc123",
    "archived": null
  }
]
```

---

### 获取会话 Todo

**端点**: `GET /api/session/:sessionID/todo`

**描述**: 获取与会话关联的 todo 列表，显示任务和行动项。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**响应**:

```json
[
  {
    "id": "todo_1",
    "content": "实现用户登录功能",
    "status": "in_progress",
    "priority": "high"
  },
  {
    "id": "todo_2",
    "content": "编写测试用例",
    "status": "pending",
    "priority": "medium"
  }
]
```

---

### 创建会话

**端点**: `POST /api/session`

**描述**: 创建新的 OpenCode 会话，用于与 AI 助手交互和管理对话。

**请求体**:

```json
{
  "title": "新会话",
  "directory": "/path/to/project",
  "parentID": "ses_parent"
}
```

| 字段        | 类型   | 必需 | 描述                   |
| ----------- | ------ | ---- | ---------------------- |
| `title`     | string | 否   | 会话标题               |
| `directory` | string | 否   | 项目目录路径           |
| `parentID`  | string | 否   | 父会话 ID（用于 fork） |

**响应**:

```json
{
  "sessionID": "ses_new123",
  "title": "新会话",
  "directory": "/path/to/project",
  "created": 1737528347000,
  "updated": 1737528347000,
  "parentID": null,
  "archived": null
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{
    "title": "实现新功能",
    "directory": "/path/to/project"
  }'
```

---

### 更新会话

**端点**: `PATCH /api/session/:sessionID`

**描述**: 更新现有会话的属性，如标题或其他元数据。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**请求体**:

```json
{
  "title": "更新后的标题",
  "time": {
    "archived": 1737528347000
  }
}
```

| 字段            | 类型   | 必需 | 描述               |
| --------------- | ------ | ---- | ------------------ |
| `title`         | string | 否   | 会话新标题         |
| `time.archived` | number | 否   | 归档时间戳（毫秒） |

**响应**:

```json
{
  "sessionID": "ses_abc123",
  "title": "更新后的标题",
  "directory": "/path/to/project",
  "created": 1737528347000,
  "updated": 1737532500000,
  "parentID": null,
  "archived": 1737528347000
}
```

**示例**:

```bash
curl -X PATCH http://localhost:3000/api/session/ses_abc123 \
  -H "Content-Type: application/json" \
  -d '{"title": "更新后的标题"}'
```

---

### 删除会话

**端点**: `DELETE /api/session/:sessionID`

**描述**: 删除会话并永久移除所有关联数据，包括消息和历史记录。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**响应**:

```json
true
```

**示例**:

```bash
curl -X DELETE http://localhost:3000/api/session/ses_abc123
```

---

### Fork 会话

**端点**: `POST /api/session/:sessionID/fork`

**描述**: 在特定消息点 fork 一个现有会话，创建新会话。

**路径参数**:

| 参数        | 类型   | 必需 | 描述              |
| ----------- | ------ | ---- | ----------------- |
| `sessionID` | string | 是   | 要 fork 的会话 ID |

**请求体**:

```json
{
  "messageID": "msg_abc123",
  "title": "Fork 的会话"
}
```

| 字段        | 类型   | 必需 | 描述                            |
| ----------- | ------ | ---- | ------------------------------- |
| `messageID` | string | 否   | 在此消息点 fork（默认最后一个） |
| `title`     | string | 否   | 新会话标题                      |

**响应**:

```json
{
  "sessionID": "ses_forked",
  "title": "Fork 的会话",
  "directory": "/path/to/project",
  "created": 1737532600000,
  "updated": 1737532600000,
  "parentID": "ses_abc123",
  "archived": null
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/session/ses_abc123/fork \
  -H "Content-Type: application/json" \
  -d '{
    "messageID": "msg_abc123",
    "title": "Fork 的会话"
  }'
```

---

### Abort 会话

**端点**: `POST /api/session/:sessionID/abort`

**描述**: 中止活跃会话并停止任何正在进行的 AI 处理或命令执行。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**响应**:

```json
true
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/session/ses_abc123/abort
```

---

### Share 会话

**端点**: `POST /api/session/:sessionID/share`

**描述**: 为会话创建可共享的链接，允许其他人查看对话。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**响应**:

```json
{
  "sessionID": "ses_abc123",
  "title": "实现新功能",
  "directory": "/path/to/project",
  "created": 1737528347000,
  "updated": 1737532600000,
  "parentID": null,
  "archived": null,
  "shareID": "share_xyz789"
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/session/ses_abc123/share
```

---

### Unshare 会话

**端点**: `DELETE /api/session/:sessionID/share`

**描述**: 移除会话的可共享链接，使其再次变为私有。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**响应**:

```json
{
  "sessionID": "ses_abc123",
  "title": "实现新功能",
  "directory": "/path/to/project",
  "created": 1737528347000,
  "updated": 1737532600000,
  "parentID": null,
  "archived": null,
  "shareID": null
}
```

**示例**:

```bash
curl -X DELETE http://localhost:3000/api/session/ses_abc123/share
```

---

### 初始化会话

**端点**: `POST /api/session/:sessionID/init`

**描述**: 分析当前应用并创建项目特定的 agent 配置的 AGENTS.md 文件。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**请求体**:

```json
{
  "directory": "/path/to/project"
}
```

| 字段        | 类型   | 必需 | 描述         |
| ----------- | ------ | ---- | ------------ |
| `directory` | string | 是   | 项目目录路径 |

**响应**:

```json
true
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/session/ses_abc123/init \
  -H "Content-Type: application/json" \
  -d '{"directory": "/path/to/project"}'
```

---

### Summarize 会话

**端点**: `POST /api/session/:sessionID/summarize`

**描述**: 使用 AI 压缩生成会话的简洁摘要，保留关键信息。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**请求体**:

```json
{
  "providerID": "anthropic",
  "modelID": "claude-3-5-sonnet-20241022",
  "auto": false
}
```

| 字段         | 类型    | 必需 | 描述                       |
| ------------ | ------- | ---- | -------------------------- |
| `providerID` | string  | 是   | 提供商 ID                  |
| `modelID`    | string  | 是   | 模型 ID                    |
| `auto`       | boolean | 否   | 是否自动压缩（默认 false） |

**响应**:

```json
true
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/session/ses_abc123/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "providerID": "anthropic",
    "modelID": "claude-3-5-sonnet-20241022"
  }'
```

---

### 获取会话消息

**端点**: `GET /api/session/:sessionID/message`

**描述**: 获取会话中的所有消息，包括用户提示和 AI 响应。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**查询参数**:

| 参数    | 类型   | 必需 | 描述             |
| ------- | ------ | ---- | ---------------- |
| `limit` | number | 否   | 返回的最大消息数 |

**响应**:

```json
[
  {
    "info": {
      "role": "user",
      "agent": "build",
      "created": 1737528347000
    },
    "parts": [
      {
        "type": "text",
        "content": "实现一个新功能"
      }
    ]
  },
  {
    "info": {
      "role": "assistant",
      "agent": "build",
      "created": 1737528400000
    },
    "parts": [
      {
        "type": "text",
        "content": "我将帮您实现这个功能..."
      },
      {
        "type": "tool_use",
        "toolName": "edit",
        "input": {...}
      }
    ]
  }
]
```

**示例**:

```bash
# 获取所有消息
curl http://localhost:3000/api/session/ses_abc123/message

# 获取最近10条消息
curl "http://localhost:3000/api/session/ses_abc123/message?limit=10"
```

---

### 获取特定消息

**端点**: `GET /api/session/:sessionID/message/:messageID`

**描述**: 从会话中获取特定消息。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |
| `messageID` | string | 是   | 消息 ID |

**响应**:

```json
{
  "info": {
    "role": "assistant",
    "agent": "build",
    "created": 1737528400000
  },
  "parts": [
    {
      "type": "text",
      "content": "我将帮您实现这个功能..."
    }
  ]
}
```

**示例**:

```bash
curl http://localhost:3000/api/session/ses_abc123/message/msg_xyz789
```

---

### 发送消息

**端点**: `POST /api/session/:sessionID/message`

**描述**: 创建并发送新消息到会话，流式传输 AI 响应。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**请求体**:

```json
{
  "content": "帮我实现一个用户登录功能",
  "agent": "build",
  "message": {
    "text": "具体需求：使用 JWT 认证"
  }
}
```

| 字段      | 类型   | 必需 | 描述                         |
| --------- | ------ | ---- | ---------------------------- |
| `content` | string | 否   | 消息内容                     |
| `agent`   | string | 否   | 使用的 agent（默认 "build"） |
| `message` | object | 否   | 附加消息数据                 |

**响应**:

```json
{
  "info": {
    "role": "assistant",
    "agent": "build",
    "created": 1737528400000
  },
  "parts": [
    {
      "type": "text",
      "content": "我将帮您实现用户登录功能..."
    }
  ]
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/session/ses_abc123/message \
  -H "Content-Type: application/json" \
  -d '{
    "content": "实现用户登录功能"
  }'
```

---

### 异步发送消息

**端点**: `POST /api/session/:sessionID/prompt_async`

**描述**: 异步创建并发送新消息到会话，如需要启动会话并立即返回。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**请求体**: 同 `POST /api/session/:sessionID/message`

**响应**: `204 No Content`

**示例**:

```bash
curl -X POST http://localhost:3000/api/session/ses_abc123/prompt_async \
  -H "Content-Type: application/json" \
  -d '{"content": "实现用户登录功能"}'
```

---

### 发送命令

**端点**: `POST /api/session/:sessionID/command`

**描述**: 向会话发送新命令以供 AI 助手执行。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**请求体**:

```json
{
  "command": "refactor",
  "input": {
    "file": "src/auth.ts"
  }
}
```

**响应**:

```json
{
  "info": {
    "role": "assistant",
    "agent": "build",
    "created": 1737528400000
  },
  "parts": [...]
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/session/ses_abc123/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "refactor",
    "input": {"file": "src/auth.ts"}
  }'
```

---

### 运行 Shell 命令

**端点**: `POST /api/session/:sessionID/shell`

**描述**: 在会话上下文中执行 shell 命令并返回 AI 的响应。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**请求体**:

```json
{
  "command": "npm install",
  "timeout": 120000
}
```

| 字段      | 类型   | 必需 | 描述             |
| --------- | ------ | ---- | ---------------- |
| `command` | string | 是   | Shell 命令       |
| `timeout` | number | 否   | 超时时间（毫秒） |

**响应**:

```json
{
  "info": {
    "role": "assistant",
    "agent": "build",
    "created": 1737528400000
  },
  "parts": [...]
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/session/ses_abc123/shell \
  -H "Content-Type: application/json" \
  -d '{
    "command": "npm install",
    "timeout": 120000
  }'
```

---

### Revert 消息

**端点**: `POST /api/session/:sessionID/revert`

**描述**: Revert 会话中的特定消息，撤销其影响并恢复之前的状态。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**请求体**:

```json
{
  "messageID": "msg_xyz789",
  "undo": true
}
```

| 字段        | 类型    | 必需 | 描述                |
| ----------- | ------- | ---- | ------------------- |
| `messageID` | string  | 是   | 要 revert 的消息 ID |
| `undo`      | boolean | 否   | 是否撤销操作        |

**响应**:

```json
{
  "sessionID": "ses_abc123",
  "title": "实现新功能",
  "directory": "/path/to/project",
  "created": 1737528347000,
  "updated": 1737532600000,
  "parentID": null,
  "archived": null
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/session/ses_abc123/revert \
  -H "Content-Type: application/json" \
  -d '{
    "messageID": "msg_xyz789",
    "undo": true
  }'
```

---

### Restore Reverted 消息

**端点**: `POST /api/session/:sessionID/unrevert`

**描述**: 恢复会话中所有之前 revert 的消息。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**响应**:

```json
{
  "sessionID": "ses_abc123",
  "title": "实现新功能",
  "directory": "/path/to/project",
  "created": 1737528347000,
  "updated": 1737532600000,
  "parentID": null,
  "archived": null
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/session/ses_abc123/unrevert
```

---

### 获取消息 Diff

**端点**: `GET /api/session/:sessionID/diff`

**描述**: 获取会话中特定用户消息产生的文件更改（diff）。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |

**查询参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `messageID` | string | 是   | 消息 ID |

**响应**:

```json
[
  {
    "path": "src/auth.ts",
    "oldPath": null,
    "status": "added",
    "additions": 25,
    "deletions": 0
  },
  {
    "path": "src/user.ts",
    "oldPath": "src/login.ts",
    "status": "renamed",
    "additions": 10,
    "deletions": 5
  }
]
```

**示例**:

```bash
curl "http://localhost:3000/api/session/ses_abc123/diff?messageID=msg_xyz789"
```

---

### 删除消息部分

**端点**: `DELETE /api/session/:sessionID/message/:messageID/part/:partID`

**描述**: 从消息中删除一个部分。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |
| `messageID` | string | 是   | 消息 ID |
| `partID`    | string | 是   | 部分 ID |

**响应**:

```json
true
```

**示例**:

```bash
curl -X DELETE \
  http://localhost:3000/api/session/ses_abc123/message/msg_xyz789/part/part1
```

---

### 更新消息部分

**端点**: `PATCH /api/session/:sessionID/message/:messageID/part/:partID`

**描述**: 更新消息中的一个部分。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `sessionID` | string | 是   | 会话 ID |
| `messageID` | string | 是   | 消息 ID |
| `partID`    | string | 是   | 部分 ID |

**请求体**:

```json
{
  "id": "part1",
  "messageID": "msg_xyz789",
  "sessionID": "ses_abc123",
  "type": "text",
  "content": "更新后的内容"
}
```

**响应**:

```json
{
  "id": "part1",
  "messageID": "msg_xyz789",
  "sessionID": "ses_abc123",
  "type": "text",
  "content": "更新后的内容"
}
```

**示例**:

```bash
curl -X PATCH \
  http://localhost:3000/api/session/ses_abc123/message/msg_xyz789/part/part1 \
  -H "Content-Type: application/json" \
  -d '{
    "id": "part1",
    "messageID": "msg_xyz789",
    "sessionID": "ses_abc123",
    "type": "text",
    "content": "更新后的内容"
  }'
```

---

## 配置管理 API

配置管理 API 提供获取和更新 OpenCode 配置设置的功能。

### 获取配置

**端点**: `GET /api/config`

**描述**: 获取当前 OpenCode 配置设置和首选项。

**响应**:

```json
{
  "models": {
    "default": "anthropic/claude-3-5-sonnet-20241022"
  },
  "agent": {
    "max_tokens": 4096,
    "timeout": 120000
  },
  "permission": [
    {
      "action": "allow",
      "permission": "bash",
      "patterns": ["*"]
    }
  ]
}
```

**示例**:

```bash
curl http://localhost:3000/api/config
```

---

### 更新配置

**端点**: `PATCH /api/config`

**描述**: 更新 OpenCode 配置设置和首选项。

**请求体**:

```json
{
  "models": {
    "default": "openai/gpt-4-turbo"
  },
  "agent": {
    "max_tokens": 8192
  }
}
```

**响应**:

```json
{
  "models": {
    "default": "openai/gpt-4-turbo"
  },
  "agent": {
    "max_tokens": 8192,
    "timeout": 120000
  }
}
```

**示例**:

```bash
curl -X PATCH http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "models": {
      "default": "openai/gpt-4-turbo"
    }
  }'
```

---

### 获取配置的提供商

**端点**: `GET /api/config/providers`

**描述**: 获取所有已配置的 AI 提供商及其默认模型。

**响应**:

```json
{
  "providers": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "models": [
        {
          "id": "claude-3-5-sonnet-20241022",
          "name": "Claude 3.5 Sonnet",
          "context": 200000
        }
      ]
    },
    {
      "id": "openai",
      "name": "OpenAI",
      "models": [
        {
          "id": "gpt-4-turbo",
          "name": "GPT-4 Turbo",
          "context": 128000
        }
      ]
    }
  ],
  "default": {
    "anthropic": "claude-3-5-sonnet-20241022",
    "openai": "gpt-4-turbo"
  }
}
```

**示例**:

```bash
curl http://localhost:3000/api/config/providers
```

---

## 文件操作 API

文件操作 API 提供文件搜索、读取和状态查询功能。

### 查找文本

**端点**: `GET /api/file/find`

**描述**: 使用 ripgrep 在项目文件中搜索文本模式。

**查询参数**:

| 参数      | 类型   | 必需 | 描述                       |
| --------- | ------ | ---- | -------------------------- |
| `pattern` | string | 是   | 搜索模式（支持正则表达式） |

**响应**:

```json
[
  {
    "path": "src/auth.ts",
    "line": 10,
    "column": 5,
    "text": "export function authenticate(token: string) {"
  },
  {
    "path": "src/user.ts",
    "line": 15,
    "column": 8,
    "text": "  return authenticate(token)"
  }
]
```

**示例**:

```bash
# 搜索简单文本
curl "http://localhost:3000/api/file/find?pattern=authenticate"

# 搜索正则表达式
curl "http://localhost:3000/api/file/find?pattern=export\s+function"
```

---

### 查找文件

**端点**: `GET /api/file/find/file`

**描述**: 在项目目录中按名称或模式搜索文件或目录。

**查询参数**:

| 参数    | 类型   | 必需 | 描述                              |
| ------- | ------ | ---- | --------------------------------- |
| `query` | string | 是   | 搜索查询                          |
| `dirs`  | string | 否   | 是否包含目录（"true" 或 "false"） |
| `type`  | string | 否   | 类型过滤（"file" 或 "directory"） |
| `limit` | number | 否   | 最大结果数（1-200，默认 10）      |

**响应**:

```json
["src/auth.ts", "src/user.ts", "tests/auth.test.ts"]
```

**示例**:

```bash
# 搜索文件
curl "http://localhost:3000/api/file/find/file?query=auth"

# 仅搜索目录
curl "http://localhost:3000/api/file/find/file?query=src&type=directory&dirs=true"

# 限制结果数量
curl "http://localhost:3000/api/file/find/file?query=ts&limit=20"
```

---

### 查找符号

**端点**: `GET /api/file/find/symbol`

**描述**: 使用 LSP 搜索工作区符号，如函数、类和变量。

**查询参数**:

| 参数    | 类型   | 必需 | 描述     |
| ------- | ------ | ---- | -------- |
| `query` | string | 是   | 符号查询 |

**响应**:

```json
[
  {
    "name": "authenticate",
    "kind": "Function",
    "containerName": "auth",
    "path": "src/auth.ts",
    "line": 10,
    "column": 5
  },
  {
    "name": "User",
    "kind": "Class",
    "containerName": null,
    "path": "src/user.ts",
    "line": 1,
    "column": 1
  }
]
```

**示例**:

```bash
curl "http://localhost:3000/api/file/find/symbol?query=authenticate"
```

---

### 列出文件

**端点**: `GET /api/file/file`

**描述**: 列出指定路径中的文件和目录。

**查询参数**:

| 参数   | 类型   | 必需 | 描述     |
| ------ | ------ | ---- | -------- |
| `path` | string | 是   | 文件路径 |

**响应**:

```json
[
  {
    "name": "auth.ts",
    "path": "/path/to/src/auth.ts",
    "type": "file",
    "size": 1024
  },
  {
    "name": "user.ts",
    "path": "/path/to/src/user.ts",
    "type": "file",
    "size": 2048
  },
  {
    "name": "components",
    "path": "/path/to/src/components",
    "type": "directory",
    "size": 0
  }
]
```

**示例**:

```bash
curl "http://localhost:3000/api/file/file?path=/path/to/src"
```

---

### 读取文件

**端点**: `GET /api/file/file/content`

**描述**: 读取指定文件的内容。

**查询参数**:

| 参数   | 类型   | 必需 | 描述     |
| ------ | ------ | ---- | -------- |
| `path` | string | 是   | 文件路径 |

**响应**:

```json
{
  "path": "/path/to/file.ts",
  "content": "export function hello() {\n  return 'world';\n}",
  "encoding": "utf-8"
}
```

**示例**:

```bash
curl "http://localhost:3000/api/file/file/content?path=/path/to/file.ts"
```

---

### 获取文件状态

**端点**: `GET /api/file/file/status`

**描述**: 获取项目中所有文件的 git 状态。

**响应**:

```json
[
  {
    "path": "src/auth.ts",
    "status": "modified"
  },
  {
    "path": "src/new-file.ts",
    "status": "added"
  },
  {
    "path": "src/old-file.ts",
    "status": "deleted"
  },
  {
    "path": "tests/auth.test.ts",
    "status": "untracked"
  }
]
```

**状态说明**:

- `modified`: 文件已修改
- `added`: 文件已添加
- `deleted`: 文件已删除
- `untracked`: 文件未追踪

**示例**:

```bash
curl http://localhost:3000/api/file/file/status
```

---

## 项目 API

项目 API 提供项目列表和项目信息查询功能。

### 列出所有项目

**端点**: `GET /api/project`

**描述**: 获取已用 OpenCode 打开的所有项目列表。

**响应**:

```json
[
  {
    "projectID": "proj_abc123",
    "name": "My Project",
    "directory": "/path/to/project",
    "icon": "folder",
    "color": "#FF5733"
  }
]
```

**示例**:

```bash
curl http://localhost:3000/api/project
```

---

### 获取当前项目

**端点**: `GET /api/project/current`

**描述**: 获取 OpenCode 当前正在工作的活跃项目。

**响应**:

```json
{
  "projectID": "proj_abc123",
  "name": "My Project",
  "directory": "/path/to/project",
  "icon": "folder",
  "color": "#FF5733"
}
```

**示例**:

```bash
curl http://localhost:3000/api/project/current
```

---

### 更新项目

**端点**: `PATCH /api/project/:projectID`

**描述**: 更新项目属性，如名称、图标和颜色。

**路径参数**:

| 参数        | 类型   | 必需 | 描述    |
| ----------- | ------ | ---- | ------- |
| `projectID` | string | 是   | 项目 ID |

**请求体**:

```json
{
  "name": "Updated Project Name",
  "icon": "code",
  "color": "#3498DB"
}
```

| 字段    | 类型   | 必需 | 描述                 |
| ------- | ------ | ---- | -------------------- |
| `name`  | string | 否   | 项目新名称           |
| `icon`  | string | 否   | 项目图标             |
| `color` | string | 否   | 项目颜色（十六进制） |

**响应**:

```json
{
  "projectID": "proj_abc123",
  "name": "Updated Project Name",
  "directory": "/path/to/project",
  "icon": "code",
  "color": "#3498DB"
}
```

**示例**:

```bash
curl -X PATCH http://localhost:3000/api/project/proj_abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Project Name",
    "color": "#3498DB"
  }'
```

---

## 提供商 API

提供商 API 提供 AI 提供商列表和认证管理功能。

### 列出提供商

**端点**: `GET /api/provider`

**描述**: 获取所有可用的 AI 提供商列表，包括可用和已连接的。

**响应**:

```json
{
  "all": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "models": [
        {
          "id": "claude-3-5-sonnet-20241022",
          "name": "Claude 3.5 Sonnet",
          "context": 200000
        }
      ]
    },
    {
      "id": "openai",
      "name": "OpenAI",
      "models": [...]
    }
  ],
  "default": {
    "anthropic": "claude-3-5-sonnet-20241022",
    "openai": "gpt-4-turbo"
  },
  "connected": ["anthropic", "openai"]
}
```

**示例**:

```bash
curl http://localhost:3000/api/provider
```

---

### 获取提供商认证方法

**端点**: `GET /api/provider/auth`

**描述**: 获取所有 AI 提供商的可用认证方法。

**响应**:

```json
{
  "anthropic": [
    {
      "type": "oauth",
      "name": "OAuth 2.0",
      "url": "https://console.anthropic.com/oauth/authorize"
    },
    {
      "type": "api_key",
      "name": "API Key",
      "instructions": "Enter your API key"
    }
  ],
  "openai": [
    {
      "type": "oauth",
      "name": "OAuth 2.0",
      "url": "https://platform.openai.com/oauth/authorize"
    },
    {
      "type": "api_key",
      "name": "API Key",
      "instructions": "Enter your API key"
    }
  ]
}
```

**示例**:

```bash
curl http://localhost:3000/api/provider/auth
```

---

### OAuth 授权

**端点**: `POST /api/provider/:providerID/oauth/authorize`

**描述**: 为特定 AI 提供商启动 OAuth 授权以获取授权 URL。

**路径参数**:

| 参数         | 类型   | 必需 | 描述      |
| ------------ | ------ | ---- | --------- |
| `providerID` | string | 是   | 提供商 ID |

**请求体**:

```json
{
  "method": 0
}
```

| 字段     | 类型   | 必需 | 描述         |
| -------- | ------ | ---- | ------------ |
| `method` | number | 是   | 认证方法索引 |

**响应**:

```json
{
  "url": "https://console.anthropic.com/oauth/authorize?code=abc123",
  "method": 0
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/provider/anthropic/oauth/authorize \
  -H "Content-Type: application/json" \
  -d '{"method": 0}'
```

---

### OAuth 回调

**端点**: `POST /api/provider/:providerID/oauth/callback`

**描述**: 处理提供商在用户授权后的 OAuth 回调。

**路径参数**:

| 参数         | 类型   | 必需 | 描述      |
| ------------ | ------ | ---- | --------- |
| `providerID` | string | 是   | 提供商 ID |

**请求体**:

```json
{
  "method": 0,
  "code": "abc123def456"
}
```

| 字段     | 类型   | 必需 | 描述         |
| -------- | ------ | ---- | ------------ |
| `method` | number | 是   | 认证方法索引 |
| `code`   | string | 否   | OAuth 授权码 |

**响应**:

```json
true
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/provider/anthropic/oauth/callback \
  -H "Content-Type: application/json" \
  -d '{
    "method": 0,
    "code": "abc123def456"
  }'
```

---

## 权限 API

权限 API 提供权限请求的响应和列表功能。

### 响应权限请求

**端点**: `POST /api/permission/:requestID/reply`

**描述**: 批准或拒绝来自 AI 助手的权限请求。

**路径参数**:

| 参数        | 类型   | 必需 | 描述        |
| ----------- | ------ | ---- | ----------- |
| `requestID` | string | 是   | 权限请求 ID |

**请求体**:

```json
{
  "reply": "allow",
  "message": "批准此操作"
}
```

| 字段      | 类型   | 必需 | 描述                               |
| --------- | ------ | ---- | ---------------------------------- |
| `reply`   | string | 是   | 响应（"allow", "deny", "correct"） |
| `message` | string | 否   | 可选消息                           |

**响应**:

```json
true
```

**示例**:

```bash
# 批准权限
curl -X POST http://localhost:3000/api/permission/req_abc123/reply \
  -H "Content-Type: application/json" \
  -d '{"reply": "allow"}'

# 拒绝权限
curl -X POST http://localhost:3000/api/permission/req_abc123/reply \
  -H "Content-Type: application/json" \
  -d '{"reply": "deny", "message": "此操作不安全"}'
```

---

### 列出待处理权限

**端点**: `GET /api/permission`

**描述**: 获取所有会话中的所有待处理权限请求。

**响应**:

```json
[
  {
    "id": "req_abc123",
    "sessionID": "ses_xyz789",
    "action": "bash",
    "command": "rm -rf *",
    "timestamp": 1737528347000
  },
  {
    "id": "req_def456",
    "sessionID": "ses_xyz789",
    "action": "edit",
    "file": "/etc/passwd",
    "timestamp": 1737528400000
  }
]
```

**示例**:

```bash
curl http://localhost:3000/api/permission
```

---

## MCP API

MCP (Model Context Protocol) API 提供 MCP 服务器的管理功能。

### 获取 MCP 状态

**端点**: `GET /api/mcp`

**描述**: 获取所有 Model Context Protocol (MCP) 服务器的状态。

**响应**:

```json
{
  "filesystem": {
    "connected": true,
    "tools": ["read_file", "write_file", "list_directory"],
    "error": null
  },
  "github": {
    "connected": false,
    "tools": [],
    "error": "Authentication failed"
  }
}
```

**示例**:

```bash
curl http://localhost:3000/api/mcp
```

---

### 添加 MCP 服务器

**端点**: `POST /api/mcp`

**描述**: 动态添加新的 Model Context Protocol (MCP) 服务器到系统。

**请求体**:

```json
{
  "name": "my-mcp-server",
  "config": {
    "command": "node",
    "args": ["server.js"],
    "env": {}
  }
}
```

| 字段             | 类型   | 必需 | 描述           |
| ---------------- | ------ | ---- | -------------- |
| `name`           | string | 是   | MCP 服务器名称 |
| `config`         | object | 是   | MCP 配置       |
| `config.command` | string | 是   | 服务器命令     |
| `config.args`    | array  | 否   | 命令参数       |
| `config.env`     | object | 否   | 环境变量       |

**响应**:

```json
{
  "my-mcp-server": {
    "connected": true,
    "tools": [],
    "error": null
  }
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-mcp-server",
    "config": {
      "command": "node",
      "args": ["server.js"]
    }
  }'
```

---

### 启动 MCP OAuth

**端点**: `POST /api/mcp/:name/auth`

**描述**: 为 Model Context Protocol (MCP) 服务器启动 OAuth 认证流程。

**路径参数**:

| 参数   | 类型   | 必需 | 描述           |
| ------ | ------ | ---- | -------------- |
| `name` | string | 是   | MCP 服务器名称 |

**响应**:

```json
{
  "authorizationUrl": "https://example.com/oauth/authorize?code=abc123"
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/mcp/github/auth
```

---

### 完成 MCP OAuth

**端点**: `POST /api/mcp/:name/auth/callback`

**描述**: 使用授权码为 Model Context Protocol (MCP) 服务器完成 OAuth 认证。

**路径参数**:

| 参数   | 类型   | 必需 | 描述           |
| ------ | ------ | ---- | -------------- |
| `name` | string | 是   | MCP 服务器名称 |

**请求体**:

```json
{
  "code": "abc123def456"
}
```

| 字段   | 类型   | 必需 | 描述                 |
| ------ | ------ | ---- | -------------------- |
| `code` | string | 是   | OAuth 回调中的授权码 |

**响应**:

```json
{
  "connected": true,
  "tools": ["read_file", "write_file"],
  "error": null
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/mcp/github/auth/callback \
  -H "Content-Type: application/json" \
  -d '{"code": "abc123def456"}'
```

---

### 认证 MCP OAuth

**端点**: `POST /api/mcp/:name/auth/authenticate`

**描述**: 启动 OAuth 流程并等待回调（打开浏览器）。

**路径参数**:

| 参数   | 类型   | 必需 | 描述           |
| ------ | ------ | ---- | -------------- |
| `name` | string | 是   | MCP 服务器名称 |

**响应**:

```json
{
  "connected": true,
  "tools": ["read_file", "write_file"],
  "error": null
}
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/mcp/github/auth/authenticate
```

---

### 移除 MCP OAuth

**端点**: `DELETE /api/mcp/:name/auth`

**描述**: 移除 MCP 服务器的 OAuth 凭证。

**路径参数**:

| 参数   | 类型   | 必需 | 描述           |
| ------ | ------ | ---- | -------------- |
| `name` | string | 是   | MCP 服务器名称 |

**响应**:

```json
{
  "success": true
}
```

**示例**:

```bash
curl -X DELETE http://localhost:3000/api/mcp/github/auth
```

---

### 连接 MCP 服务器

**端点**: `POST /api/mcp/:name/connect`

**描述**: 连接 MCP 服务器。

**路径参数**:

| 参数   | 类型   | 必需 | 描述           |
| ------ | ------ | ---- | -------------- |
| `name` | string | 是   | MCP 服务器名称 |

**响应**:

```json
true
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/mcp/filesystem/connect
```

---

### 断开 MCP 服务器

**端点**: `POST /api/mcp/:name/disconnect`

**描述**: 断开 MCP 服务器。

**路径参数**:

| 参数   | 类型   | 必需 | 描述           |
| ------ | ------ | ---- | -------------- |
| `name` | string | 是   | MCP 服务器名称 |

**响应**:

```json
true
```

**示例**:

```bash
curl -X POST http://localhost:3000/api/mcp/filesystem/disconnect
```

---

## 全局 API

全局 API 提供全局级功能和信息查询。

**端点**: `GET /api/global`

**描述**: 获取全局系统信息和状态。

**响应**:

```json
{
  "version": "1.0.0",
  "status": "running",
  "uptime": 3600000
}
```

**示例**:

```bash
curl http://localhost:3000/api/global
```

---

## 错误响应

所有 API 端点在错误情况下返回统一的错误格式：

### 错误响应格式

```json
{
  "error": {
    "code": "Provider.ModelNotFoundError",
    "message": "Model not found: openai/gpt-5",
    "data": {
      "providerID": "openai",
      "modelID": "gpt-5",
      "suggestions": ["openai/gpt-4-turbo", "openai/gpt-3.5-turbo"]
    }
  }
}
```

### 常见错误代码

| HTTP 状态码 | 错误类型              | 描述                     |
| ----------- | --------------------- | ------------------------ |
| 400         | Bad Request           | 请求参数无效或缺失       |
| 401         | Unauthorized          | 认证失败或未提供认证信息 |
| 403         | Forbidden             | 权限不足                 |
| 404         | Not Found             | 资源不存在               |
| 429         | Too Many Requests     | 超过速率限制             |
| 500         | Internal Server Error | 服务器内部错误           |

**相关文档**:

- [44-错误代码参考.md](./44-错误代码参考.md) - 完整错误代码参考

---

## 速率限制

为了保护服务器和确保公平使用，API 实施了速率限制：

### 速率限制规则

| 端点类型 | 限制     | 时间窗口 |
| -------- | -------- | -------- |
| 会话 API | 100 请求 | 1 分钟   |
| 文件 API | 50 请求  | 1 分钟   |
| 配置 API | 20 请求  | 1 分钟   |
| 其他 API | 30 请求  | 1 分钟   |

### 速率限制响应头

当触发速率限制时，响应将包含以下头信息：

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1737528400
Retry-After: 60
```

### 处理速率限制

当收到 429 响应时：

1. 等待 `Retry-After` 头中指定的秒数
2. 检查 `X-RateLimit-Remaining` 头以了解剩余请求数
3. 使用指数退避策略重试请求

**示例**:

```typescript
async function makeRequest(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url)
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "60")
        await sleep(retryAfter * 1000)
        continue
      }
      return response
    } catch (error) {
      if (i === retries - 1) throw error
      await sleep(Math.pow(2, i) * 1000) // 指数退避
    }
  }
}
```

---

## 相关文档

- [01-架构总览.md](./01-架构总览.md) - 整体架构设计
- [02-服务器架构.md](./02-服务器架构.md) - 服务器实现详解
- [07-会话管理详解.md](./07-会话管理详解.md) - 会话系统深入理解
- [44-错误代码参考.md](./44-错误代码参考.md) - 完整错误代码参考
- [10-认证与授权.md](./10-认证与授权.md) - 详细认证机制

---

_文档版本：1.0.0_
_最后更新：2026-01-22_
