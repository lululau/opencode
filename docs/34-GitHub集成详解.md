# GitHub 集成详解

## 目录

1. [GitHub 集成概述](#github-集成概述)
2. [架构设计](#架构设计)
3. [Issue 处理](#issue-处理)
4. [PR 创建与管理](#pr-创建与管理)
5. [代码审查集成](#代码审查集成)
6. [Webhook 处理](#webhook-处理)
7. [GitHub Actions 集成](#github-actions-集成)
8. [配置与安装](#配置与安装)
9. [CLI 命令](#cli-命令)
10. [工具系统](#工具系统)
11. [事件系统](#事件系统)
12. [最佳实践](#最佳实践)

---

## GitHub 集成概述

OpenCode 提供完整的 GitHub 集成，允许开发者在 GitHub Issues、Pull Requests 和代码审查评论中直接使用 AI 代理进行代码分析、问题解决和自动化任务。

### 核心功能

- **Issue 智能处理**：自动分析 Issue 内容，提供解决方案和代码实现
- **Pull Request 管理**：支持 PR 创建、审核、修改和合并建议
- **代码审查**：自动审查代码，提供建议和改进
- **Webhook 响应**：通过 GitHub Actions 和 Webhook 实时响应 GitHub 事件
- **权限管理**：细粒度的 GitHub API 访问控制
- **Fork 支持**：处理来自 Fork 的 PR，自动创建正确的远程分支

### 支持的 GitHub 事件

| 事件类型                      | 触发条件             | 处理方式               |
| ----------------------------- | -------------------- | ---------------------- |
| `issue_comment`               | 在 Issue 中评论      | 回复评论，执行 AI 分析 |
| `pull_request_review_comment` | 在 PR 代码审查中评论 | 回复评论，提供代码建议 |
| `issues`                      | 创建/更新 Issue      | 自动分析，提供解决方案 |
| `pull_request`                | 创建/更新 PR         | 审查代码，提供建议     |
| `schedule`                    | 定时任务             | 自动化任务执行         |
| `workflow_dispatch`           | 手动触发工作流       | 按需执行任务           |

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                      GitHub Platform                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  │   Issues     │  │   Pull       │  │   Code       │
│  │   Events     │  │   Requests   │  │   Review     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
│         │                  │                  │
└─────────┼──────────────────┼──────────────────┘
          │                  │
    ┌─────┴──────────────────┴─────┐
    │    GitHub Actions Workflow   │
    │    (.github/workflows/)    │
    └─────┬──────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   OpenCode GitHub Agent                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  │ Event Parser │  │ Context     │  │ AI Session  │
│  │             │  │ Builder     │  │ Manager     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
│         │                  │                  │
└─────────┼──────────────────┼──────────────────┘
          │                  │
          ▼                  ▼
    ┌─────────┐       ┌──────────┐
    │ GitHub  │       │  OpenCode│
    │ API     │       │  Server  │
    │ Client  │       │          │
    └────┬────┘       └────┬─────┘
         │                │
         └────────┬───────┘
                  ▼
          ┌────────────────┐
          │ Response      │
          │ Handler      │
          └────────────────┘
```

### 核心组件

| 组件                | 位置                                      | 职责                          |
| ------------------- | ----------------------------------------- | ----------------------------- |
| **GitHub CLI**      | `packages/opencode/src/cli/cmd/github.ts` | GitHub 命令行接口、安装、运行 |
| **Event Parser**    | `packages/opencode/src/cli/cmd/github.ts` | 解析 GitHub Webhook 事件      |
| **Context Builder** | `packages/opencode/src/cli/cmd/github.ts` | 构建 AI 会话上下文            |
| **Session Manager** | `packages/opencode/src/session/`          | 管理会话和消息流              |
| **GitHub Tools**    | `.opencode/tool/github-*.ts`              | GitHub 相关工具实现           |

### 数据流

```
GitHub Event (Webhook)
    ↓
GitHub Actions Workflow
    ↓
OpenCode Agent (github run)
    ↓
Parse Event Type
    ↓
Fetch Context (Issue/PR Data)
    ↓
Build Prompt (with Context)
    ↓
AI Processing
    ↓
Tool Execution (GitHub API, File Ops, etc.)
    ↓
Generate Response
    ↓
Post Comment / Update Issue
```

---

## Issue 处理

### Issue 事件类型

OpenCode 支持以下 Issue 相关事件：

#### 1. `issues` 事件

当创建或更新 Issue 时触发：

```typescript
// packages/opencode/src/cli/cmd/github.ts
type GitHubIssue = {
  title: string
  body: string
  author: GitHubAuthor
  createdAt: string
  state: string
  comments: {
    nodes: GitHubComment[]
  }
}
```

**处理流程**：

```typescript
async function buildPromptDataForIssue(issue: GitHubIssue) {
  const comments = issue.comments.nodes.map((c) => ({
    role: "user" as const,
    content: `[Comment by ${c.author.login}]: ${c.body}`,
  }))

  return {
    messages: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: [
              "<github_action_context>",
              "You are running as a GitHub Action. Important:",
              "- Do NOT include warnings or disclaimers about GitHub tokens, workflow permissions, or PR creation capabilities",
              "- Focus on solving the issue at hand efficiently",
              "</github_action_context>",
              "",
              `Issue #${issueId}: ${issue.title}`,
              `Author: ${issue.author.login}`,
              `Created: ${issue.createdAt}`,
              "",
              "Issue Description:",
              issue.body,
            ].join("\n"),
          },
        ],
      },
      ...comments,
    ],
  }
}
```

#### 2. `issue_comment` 事件

当在 Issue 中添加评论时触发：

```typescript
type IssueCommentEvent = {
  action: "created" | "edited" | "deleted"
  issue: {
    number: number
    title: string
    body: string
    user: GitHubAuthor
  }
  comment: {
    id: string
    user: GitHubAuthor
    body: string
    created_at: string
  }
  repository: {
    owner: { login: string }
    name: string
  }
}
```

**处理流程**：

1. **验证触发条件**：检查评论是否包含 `/oc` 或 `/opencode` 命令
2. **添加反应**：添加 👀 反应表示正在处理
3. **获取完整上下文**：获取 Issue 详情和所有评论
4. **构建提示词**：包含 Issue 标题、描述、评论历史
5. **AI 处理**：分析内容，执行相关操作
6. **发布回复**：在 Issue 中发布 AI 回复
7. **更新反应**：将反应改为 ✅ 表示完成

**命令触发示例**：

```yaml
# .github/workflows/opencode.yml
on:
  issue_comment:
    types: [created]

jobs:
  opencode:
    if: |
      contains(github.event.comment.body, ' /oc') ||
      startsWith(github.event.comment.body, '/oc') ||
      contains(github.event.comment.body, ' /opencode') ||
      startsWith(github.event.comment.body, '/opencode')
    runs-on: ubuntu-latest
    steps:
      - uses: anomalyco/opencode/github@latest
```

### Issue 处理示例

**场景 1：Bug 报告**

用户创建 Issue：

```
# Bug: Login fails with OAuth error

Steps to reproduce:
1. Click login button
2. Select Google OAuth
3. Error occurs: "Invalid redirect URI"
```

OpenCode Agent 处理：

```typescript
// 1. 分析 Issue
const analysis = await analyzeIssue(issue)

// 2. 识别问题
const problem = "OAuth redirect URI configuration mismatch"

// 3. 定位代码
const files = await searchCode("oauth", "redirect_uri")

// 4. 修复代码
const fix = await generateFix(files, problem)

// 5. 创建 PR
const pr = await createPR({
  title: `Fix: ${issue.title}`,
  body: `Fixes #${issueId}\n\n${fix.description}`,
  branch: `fix/issue-${issueId}`,
})
```

**场景 2：功能请求**

用户在 Issue 评论：`/oc implement feature X`

OpenCode Agent 处理：

```typescript
// 1. 理解需求
const requirements = await analyzeFeatureRequest(comment)

// 2. 设计实现方案
const design = await designImplementation(requirements)

// 3. 实现代码
const implementation = await implement(design)

// 4. 创建测试
const tests = await generateTests(implementation)

// 5. 创建 PR 并关联 Issue
await createPR({
  title: `Feat: ${requirements.title}`,
  body: `Implements feature requested in #${issueId}`,
  labels: ["feature"],
})
```

---

## PR 创建与管理

### Pull Request 事件

OpenCode 支持以下 PR 相关事件：

#### 1. `pull_request` 事件

当创建、更新或合并 PR 时触发：

```typescript
type GitHubPullRequest = {
  title: string
  body: string
  author: GitHubAuthor
  baseRefName: string
  headRefName: string
  headRefOid: string
  createdAt: string
  additions: number
  deletions: number
  state: string
  baseRepository: {
    nameWithOwner: string
  }
  headRepository: {
    nameWithOwner: string
  }
  commits: {
    totalCount: number
    nodes: Array<{
      commit: GitHubCommit
    }>
  }
  files: {
    nodes: GitHubFile[]
  }
  comments: {
    nodes: GitHubComment[]
  }
  reviews: {
    nodes: GitHubReview[]
  }
}
```

#### 2. `pull_request_review_comment` 事件

当在 PR 代码审查中添加评论时触发：

```typescript
type PullRequestReviewCommentEvent = {
  action: "created" | "edited" | "deleted"
  pull_request: {
    number: number
    title: string
    head: {
      ref: string
      sha: string
      repo: {
        full_name: string
      }
    }
    base: {
      ref: string
    }
  }
  comment: {
    id: string
    user: GitHubAuthor
    body: string
    path: string
    line: number
    created_at: string
  }
  repository: {
    owner: { login: string }
    name: string
  }
}
```

### PR 创建流程

OpenCode Agent 可以自动创建 PR 来解决 Issue：

```typescript
// packages/opencode/src/cli/cmd/github.ts
async function checkoutForkBranch(pr: GitHubPullRequest) {
  // 添加 fork 远程
  await $`git remote add fork https://github.com/${pr.headRepository.nameWithOwner}.git`

  // 获取 fork 分支
  await $`git fetch fork ${pr.headRefName}:${pr.headRefName}`

  // 切换到分支
  await $`git checkout ${pr.headRefName}`

  // 配置用户
  await $`git config user.email "${AGENT_USERNAME}@users.noreply.github.com"`
  await $`git config user.name "${AGENT_USERNAME}"`
}

async function pushToForkBranch(summary: string, pr: GitHubPullRequest, commit: boolean) {
  if (commit) {
    // 配置 co-author
    const actor = context.actor
    const coAuthor = `Co-authored-by: ${actor} <${actor}@users.noreply.github.com>"`

    // 提交更改
    await $`git commit -m "${summary}\n\n${coAuthor}"`
  }

  // 推送到 fork
  await $`git push fork ${pr.headRefName}`
}
```

**完整流程**：

```
1. 分析 Issue
    ↓
2. 设计解决方案
    ↓
3. 创建功能分支
    ↓
4. 实现代码
    ↓
5. 运行测试
    ↓
6. 提交更改
    ↓
7. 推送到远程
    ↓
8. 创建 PR
    ↓
9. 关联原 Issue
```

### PR 审查流程

OpenCode Agent 可以自动审查 PR：

```typescript
async function reviewPR(pr: GitHubPullRequest) {
  // 1. 获取 PR 文件
  const files = pr.files.nodes

  // 2. 分析代码
  const reviews = await Promise.all(
    files.map(async (file) => ({
      path: file.path,
      review: await analyzeCode(file),
    })),
  )

  // 3. 提取建议
  const suggestions = reviews.flatMap((r) => r.review.suggestions)

  // 4. 发布审查评论
  for (const suggestion of suggestions) {
    await octokit.rest.pulls.createReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      body: suggestion.message,
      path: suggestion.path,
      line: suggestion.line,
    })
  }

  // 5. 发布整体审查
  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    body: generateReviewSummary(reviews),
    event: "COMMENT",
  })
}
```

### PR 处理示例

**场景 1：修复 Bug PR**

用户在 Issue 评论：`/oc fix bug in login`

OpenCode Agent 处理：

```typescript
// 1. 检出代码
await checkoutLocalBranch(pr)

// 2. 定位问题
const bugLocation = await findBug(issueDescription)

// 3. 修复代码
await fixCode(bugLocation)

// 4. 运行测试
await runTests()

// 5. 提交
await commitChanges(`Fix: ${issueTitle}`)

// 6. 推送
await pushToOrigin()

// 7. 更新 PR
await updatePR(pr.number, {
  body: `Fixes #${issueId}\n\nChanges:\n- Fixed login bug\n- Added test coverage`,
})
```

**场景 2：审查 PR 代码**

用户在 PR 代码审查中评论：`/oc review this function`

OpenCode Agent 处理：

```typescript
// 1. 获取文件内容
const file = await getFile(comment.path)

// 2. 分析函数
const analysis = await analyzeFunction(file, comment.line)

// 3. 提供建议
const suggestions = [
  "Consider adding error handling",
  "Extract this logic into a separate function",
  "Add type annotations",
]

// 4. 回复评论
await replyToComment(comment.id, analysis.suggestions)
```

---

## 代码审查集成

### 审查触发条件

OpenCode 在以下场景触发代码审查：

1. **手动触发**：在 PR 中使用 `/oc review` 命令
2. **自动触发**：PR 创建时自动审查（如果配置）
3. **代码审查评论**：在特定行使用 `/oc analyze`

### 审查流程

```typescript
// packages/opencode/src/cli/cmd/github.ts
type GitHubReviewComment = GitHubComment & {
  path: string
  line: number | null
}

type GitHubReview = {
  id: string
  databaseId: string
  author: GitHubAuthor
  body: string
  state: string
  submittedAt: string
  comments: {
    nodes: GitHubReviewComment[]
  }
}
```

**审查步骤**：

```typescript
async function performCodeReview(pr: GitHubPullRequest) {
  // 1. 收集上下文
  const context = {
    title: pr.title,
    description: pr.body,
    files: pr.files.nodes,
    commits: pr.commits.nodes,
  }

  // 2. 分析每个文件
  const fileReviews = await Promise.all(
    context.files.map(async (file) => ({
      path: file.path,
      changes: {
        additions: file.additions,
        deletions: file.deletions,
      },
      analysis: await analyzeFileChanges(file),
    })),
  )

  // 3. 生成审查意见
  const review = {
    overall: generateOverallReview(fileReviews),
    suggestions: fileReviews.flatMap((r) => r.analysis.suggestions),
    concerns: fileReviews.flatMap((r) => r.analysis.concerns),
  }

  // 4. 发布评论
  await postReviewComment(pr.number, review)

  return review
}
```

### 审查维度

OpenCode Agent 从多个维度审查代码：

| 维度         | 检查内容             | 严重级别 |
| ------------ | -------------------- | -------- |
| **正确性**   | 逻辑错误、边界条件   | 🔴 高    |
| **性能**     | 时间复杂度、资源使用 | 🟡 中    |
| **安全性**   | 输入验证、敏感数据   | 🔴 高    |
| **可维护性** | 代码结构、命名       | 🟢 低    |
| **测试覆盖** | 测试用例、边缘情况   | 🟡 中    |
| **文档**     | 注释、README         | 🟢 低    |
| **风格**     | 代码规范、格式       | 🟢 低    |

### 审查输出示例

````
## Code Review: #123

### Overall Assessment: ⚠️ Needs Review

### 🔴 High Priority Issues

1. **SQL Injection Vulnerability** (`src/db/query.ts:45`)
   ```typescript
   const query = `SELECT * FROM users WHERE id = ${userId}`
````

**Suggestion**: Use parameterized queries to prevent SQL injection.

### 🟡 Medium Priority Issues

1. **Performance: O(n²) nested loop** (`src/algo/sort.ts:23`)

   ```typescript
   for (let i = 0; i < arr.length; i++) {
     for (let j = 0; j < arr.length; j++) {
       // ...
     }
   }
   ```

   **Suggestion**: Consider using built-in sort or optimized algorithm.

2. **Missing error handling** (`src/api/user.ts:67`)
   ```typescript
   const user = await db.getUser(id)
   return user
   ```
   **Suggestion**: Add try-catch and handle null case.

### 🟢 Suggestions

1. **Add JSDoc comments** for exported functions
2. **Extract magic numbers** to named constants
3. **Consider adding tests** for edge cases

### Positive Aspects

✅ Clean function structure
✅ Good use of TypeScript types
✅ Consistent naming convention

````

---

## Webhook 处理

### Webhook 事件类型

OpenCode 支持两种类别的事件：

#### 1. 用户事件 (USER_EVENTS)

触发用户操作，有 actor 和 issueId，支持反应和评论：

```typescript
const USER_EVENTS = [
  "issue_comment",
  "pull_request_review_comment",
  "issues",
  "pull_request"
] as const
````

**特点**：

- 有明确的触发者（actor）
- 关联到具体的 Issue 或 PR
- 可以添加反应（👀, ✅）
- 可以发布评论回复

#### 2. 仓库事件 (REPO_EVENTS)

自动化触发，无 actor 和 issueId，输出到日志和 PR：

```typescript
const REPO_EVENTS = ["schedule", "workflow_dispatch"] as const
```

**特点**：

- 无明确的触发者
- 不关联到具体的 Issue 或 PR
- 输出到 GitHub Actions 日志
- 可以创建或更新 PR

### 事件路由

```typescript
// packages/opencode/src/cli/cmd/github.ts
const SUPPORTED_EVENTS = [...USER_EVENTS, ...REPO_EVENTS] as const

async function handleEvent(context: Context) {
  const eventName = context.eventName

  // 验证事件类型
  if (!SUPPORTED_EVENTS.includes(eventName as (typeof SUPPORTED_EVENTS)[number])) {
    core.setFailed(`Unsupported event type: ${eventName}`)
    return
  }

  // 确定事件类别
  const isUserEvent = USER_EVENTS.includes(eventName as UserEvent)
  const isRepoEvent = REPO_EVENTS.includes(eventName as RepoEvent)

  if (isUserEvent) {
    await handleUserEvent(context)
  } else if (isRepoEvent) {
    await handleRepoEvent(context)
  }
}
```

### 事件处理流程

#### 用户事件处理

```typescript
async function handleUserEvent(context: Context) {
  const { owner, repo } = context.repo
  const payload = context.payload as IssueCommentEvent | PullRequestReviewCommentEvent

  // 1. 提取事件数据
  const issueId =
    context.eventName === "issue_comment"
      ? (payload as IssueCommentEvent).issue.number
      : (payload as PullRequestReviewCommentEvent).pull_request.number

  const triggerCommentId = (payload as IssueCommentEvent | PullRequestReviewCommentEvent).comment.id

  // 2. 验证触发条件
  const shouldTrigger = checkTriggerCondition(payload)
  if (!shouldTrigger) return

  // 3. 添加反应
  await addReaction(issueId, triggerCommentId, "eyes")

  // 4. 获取认证
  const token = await getAuthentication()

  // 5. 初始化 GitHub API 客户端
  const octokit = new Octokit({ auth: token })

  // 6. 获取完整上下文
  const contextData = await fetchIssueContext(octokit, owner, repo, issueId)

  // 7. 构建提示词
  const prompt = buildPrompt(contextData)

  // 8. 运行 AI 会话
  const session = await runAISession(prompt)

  // 9. 提取响应文本
  const responseText = extractResponseText(session.messages)

  // 10. 发布回复
  await postComment(issueId, responseText)

  // 11. 更新反应
  await updateReaction(issueId, triggerCommentId, "eyes", "rocket")
}
```

#### 仓库事件处理

```typescript
async function handleRepoEvent(context: Context) {
  const { owner, repo } = context.repo
  const payload = context.payload as WorkflowDispatchEvent

  // 1. 解析触发参数
  const inputs = payload.inputs || {}

  // 2. 获取认证
  const token = await getAuthentication()

  // 3. 初始化 GitHub API 客户端
  const octokit = new Octokit({ auth: token })

  // 4. 执行任务
  const result = await executeTask(inputs)

  // 5. 输出结果到日志
  core.setOutput("result", JSON.stringify(result))

  // 6. 如果需要，创建或更新 PR
  if (result.shouldCreatePR) {
    await createOrUpdatePR(octokit, result)
  }
}
```

### Webhook 签名验证

```typescript
async function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const crypto = require("crypto")

  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex")

  const receivedSignature = signature.replace("sha256=", "")

  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature))
}
```

---

## GitHub Actions 集成

### 工作流文件

OpenCode 提供预配置的 GitHub Actions 工作流模板：

```yaml
# .github/workflows/opencode.yml
name: opencode

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  opencode:
    if: |
      contains(github.event.comment.body, ' /oc') ||
      startsWith(github.event.comment.body, '/oc') ||
      contains(github.event.comment.body, ' /opencode') ||
      startsWith(github.event.comment.body, '/opencode')
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      pull-requests: read
      issues: read
    steps:
      - name: Checkout repository
        uses: actions/checkout@v6
        with:
          persist-credentials: false

      - name: Run opencode
        uses: anomalyco/opencode/github@latest
        with:
          model: anthropic/claude-sonnet-4-20250514
```

### 权限配置

工作流需要适当的 GitHub 权限：

| 权限                   | 用途            | 必需 |
| ---------------------- | --------------- | ---- |
| `id-token: write`      | OIDC 认证       | ✅   |
| `contents: read`       | 读取代码        | ✅   |
| `contents: write`      | 创建分支/PR     | 🟡   |
| `pull-requests: read`  | 读取 PR         | ✅   |
| `pull-requests: write` | 更新 PR/评论    | 🟡   |
| `issues: read`         | 读取 Issue      | ✅   |
| `issues: write`        | 更新 Issue/评论 | 🟡   |

### 认证方式

#### 方式 1：OIDC (推荐)

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: anomalyco/opencode/github@latest
    with:
      model: opencode/sonnet-4
```

**优势**：

- 无需管理密钥
- 自动轮换
- 更安全

#### 方式 2：Personal Access Token

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

steps:
  - uses: anomalyco/opencode/github@latest
    with:
      model: anthropic/claude-sonnet-4
      use_github_token: true
```

**优势**：

- 简单直接
- 适用于个人仓库

#### 方式 3：API Key

```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

steps:
  - uses: anomalyco/opencode/github@latest
    with:
      model: anthropic/claude-sonnet-4
```

### 高级配置

#### 定时任务

```yaml
on:
  schedule:
    - cron: "0 9 * * 1" # 每周一早上 9 点运行

jobs:
  daily-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: anomalyco/opencode/github@latest
        with:
          event: |
            {
              "event_name": "schedule",
              "payload": {}
            }
```

#### 手动触发

```yaml
on:
  workflow_dispatch:
    inputs:
      task:
        description: "Task to run"
        required: true
        type: choice
        options:
          - review-prs
          - analyze-issues
          - update-docs

jobs:
  manual-task:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: anomalyco/opencode/github@latest
        with:
          event: |
            {
              "event_name": "workflow_dispatch",
              "inputs": {
                "task": "${{ github.event.inputs.task }}"
              }
            }
```

### 自定义工作流示例

#### 示例 1：自动代码审查

```yaml
name: Auto Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Run OpenCode review
        uses: anomalyco/opencode/github@latest
        with:
          model: anthropic/claude-sonnet-4
          event: |
            {
              "event_name": "pull_request",
              "payload": ${{ toJson(github.event) }}
            }
```

#### 示例 2：Issue 自动分类

```yaml
name: Issue Auto-label

on:
  issues:
    types: [opened]

jobs:
  label:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      issues: write
    steps:
      - uses: actions/checkout@v6

      - name: Analyze and label issue
        uses: anomalyco/opencode/github@latest
        with:
          model: anthropic/claude-sonnet-4
          event: |
            {
              "event_name": "issues",
              "payload": ${{ toJson(github.event) }}
            }
```

---

## 配置与安装

### 安装 GitHub App

```bash
# 1. 运行安装命令
opencode github install

# 2. 按照提示选择：
#    - Provider: opencode / anthropic / openai / google
#    - Model: 选择可用模型

# 3. 工作流文件会自动添加到 .github/workflows/opencode.yml

# 4. 配置环境变量（如果需要）
#    在 GitHub 仓库设置中添加 Secrets
```

### 认证配置

#### OpenCode (推荐)

```bash
# 无需额外配置，使用 OIDC 自动认证
```

#### Anthropic

```bash
# 添加 Secret: ANTHROPIC_API_KEY
# 在 GitHub 仓库设置 > Secrets > New repository secret
```

#### OpenAI

```bash
# 添加 Secret: OPENAI_API_KEY
# 在 GitHub 仓库设置 > Secrets > New repository secret
```

#### Google

```bash
# 添加 Secret: GOOGLE_API_KEY
# 在 GitHub 仓库设置 > Secrets > New repository secret
```

#### Amazon Bedrock (OIDC)

```bash
# 在 AWS IAM 中配置 OIDC provider
# 参考文档: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
```

### 配置文件

`opencode.json` 可以包含 GitHub 相关配置：

```json
{
  "github": {
    "app": {
      "enabled": true,
      "installationId": "12345678"
    },
    "agent": {
      "model": "anthropic/claude-sonnet-4-20250514",
      "permissions": {
        "issues": "read",
        "pullRequests": "write",
        "contents": "write"
      }
    }
  }
}
```

---

## CLI 命令

### `opencode github install`

安装 GitHub App 和配置工作流。

```bash
opencode github install
```

**交互流程**：

1. 检测 git 仓库信息
2. 打开 GitHub App 安装页面
3. 等待 App 安装完成
4. 选择 AI 提供商
5. 选择模型
6. 生成工作流文件
7. 显示后续步骤

**输出示例**：

```
✓ Installed GitHub app
✓ Added workflow file: ".github/workflows/opencode.yml"

Next steps:
    1. Commit `.github/workflows/opencode.yml` file and push
    2. Add following secrets in org or repo (owner/repo) settings
       - ANTHROPIC_API_KEY
    3. Go to a GitHub issue and comment `/oc summarize` to see agent in action
```

### `opencode github run`

运行 GitHub Agent（用于调试）。

```bash
# 使用模拟事件
opencode github run --event event.json

# 使用 GitHub PAT
opencode github run --token github_pat_xxxxxxxxx
```

**事件文件格式**：

```json
{
  "event_name": "issue_comment",
  "payload": {
    "action": "created",
    "issue": {
      "number": 123,
      "title": "Bug report",
      "body": "Description of the bug"
    },
    "comment": {
      "id": "456",
      "user": {
        "login": "username"
      },
      "body": "/oc analyze this issue"
    },
    "repository": {
      "owner": {
        "login": "owner"
      },
      "name": "repo"
    }
  }
}
```

---

## 工具系统

OpenCode 提供 GitHub 相关的工具，可以在会话中使用：

### `github-pr-search`

搜索 Pull Request。

**参数**：

- `query` (string): 搜索查询
- `limit` (number): 最大结果数 (默认: 10)
- `offset` (number): 跳过的结果数 (默认: 0)

**使用示例**：

```
User: Search for PRs about authentication
AI: Let me search for PRs related to authentication...
[Calls github-pr-search tool]
```

### `github-triage`

自动分类和分配 Issue。

**参数**：

- `assignee` (enum): 指派给谁
- `labels` (array of enum): 添加的标签

**使用示例**：

```
User: Assign this bug to rekram1-node and add the docs label
AI: I'll assign this issue to rekram1-node and add the docs label...
[Calls github-triage tool]
```

**可用选项**：

**Assignees**:

- `thdxr` - 核心架构、大型功能请求
- `adamdotdevin` - Desktop/Web 应用
- `rekram1-node` - 通用 Bug 和 Polish
- `fwang` - OpenCode Zen 相关
- `jayair` - 文档相关
- `kommander` - OpenTUI 相关

**Labels**:

- `nix` - Nix/NixOS 相关
- `opentui` - TUI 组件
- `perf` - 性能问题
- `desktop` - Desktop 应用 (web 标签)
- `zen` - OpenCode Zen
- `docs` - 文档
- `windows` - Windows 相关

---

## 事件系统

### 工具执行事件

OpenCode 在 GitHub 事件处理过程中发布事件：

```typescript
// packages/opencode/src/cli/cmd/github.ts
// Agent 上下文
"<github_action_context>",
"You are running as a GitHub Action. Important:",
"- Do NOT include warnings or disclaimers about GitHub tokens, workflow permissions, or PR creation capabilities",
"- Focus on solving the issue at hand efficiently",
"</github_action_context>",
```

### 反应事件

OpenCode 使用 GitHub 反应来表示处理状态：

| 反应 | 含义     |
| ---- | -------- |
| 👀   | 正在处理 |
| 🚀   | 处理完成 |
| ❌   | 处理失败 |

```typescript
async function addReaction(issueId: number, commentId: string, reaction: string) {
  await octokit.rest.reactions.createForIssueComment({
    owner,
    repo,
    comment_id: commentId,
    content: reaction,
  })
}

async function updateReaction(issueId: number, commentId: string, oldReaction: string, newReaction: string) {
  // 删除旧反应
  await octokit.rest.reactions.deleteForIssueComment({
    owner,
    repo,
    comment_id: commentId,
  })

  // 添加新反应
  await addReaction(issueId, commentId, newReaction)
}
```

---

## 最佳实践

### Issue 管理

1. **清晰的标题**：使用描述性标题，如 "Bug: Login fails with error" 或 "Feat: Add dark mode"
2. **详细描述**：包含复现步骤、预期行为、实际行为
3. **提供上下文**：相关代码链接、错误日志、环境信息
4. **使用标签**：合理使用标签便于分类和筛选

### PR 管理

1. **小而频繁**：保持 PR 小规模，便于审查和合并
2. **清晰描述**：说明变更目的和影响
3. **关联 Issue**：在 PR 描述中关联 "Fixes #123"
4. **自审**：在提交前自己审查代码

### AI 交互

1. **明确指令**：使用清晰的命令，如 "/oc fix this bug"
2. **提供上下文**：提供足够的上下文信息
3. **迭代改进**：基于 AI 反馈迭代改进
4. **验证结果**：验证 AI 生成的代码

### 安全实践

1. **最小权限**：只授予工作流必要的权限
2. **密钥管理**：使用 GitHub Secrets 存储敏感信息
3. **审查代码**：审查 AI 生成的代码
4. **测试覆盖**：为 AI 生成的代码添加测试

### 性能优化

1. **缓存依赖**：使用 GitHub Actions 缓存
2. **并行处理**：并行执行独立任务
3. **增量分析**：只分析变更的文件
4. **限制范围**：限制分析的文件和行数

### 故障排除

| 问题              | 原因           | 解决方案                       |
| ----------------- | -------------- | ------------------------------ |
| GitHub App 未触发 | 工作流未安装   | 运行 `opencode github install` |
| 认证失败          | Secret 未配置  | 在仓库设置中添加 Secret        |
| 权限错误          | 工作流权限不足 | 更新 `permissions` 配置        |
| 反应未添加        | Bot 无权限     | 确保 App 有 reactions 权限     |
| 评论未发布        | 超时或错误     | 检查 GitHub Actions 日志       |

---

## 参考资源

- **GitHub Actions 文档**：https://docs.github.com/en/actions
- **GitHub Webhooks 文档**：https://docs.github.com/en/developers/webhooks-and-events
- **Octokit 文档**：https://octokit.github.io/rest.js/
- **OpenCode GitHub 集成**：https://opencode.ai/docs/github/
- **GitHub App 配置**：https://github.com/apps/opencode-agent

---

_文档版本：1.0.0_
_最后更新：2026-01-22_
