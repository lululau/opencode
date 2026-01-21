# 集成 MCP 服务器实战

## 目录

1. [概述](#概述)
2. [MCP 协议](#mcp-协议)
3. [服务器实现](#服务器实现)
4. [工具定义](#工具定义)
5. [测试调试](#测试调试)
6. [部署](#部署)
7. [完整示例](#完整示例)
8. [最佳实践](#最佳实践)

---

## 概述

本教程将带你从零开始创建一个 MCP (Model Context Protocol) 服务器，并将其集成到 OpenCode。我们将创建一个实际的案例——**文件管理 MCP 服务器**，展示完整的开发流程。

### 什么是 MCP？

Model Context Protocol (MCP) 是一种开放协议，允许 AI 代理连接到外部服务器，使用额外的工具、资源和提示词。

### MCP 优势

- ✅ **扩展性**: 无需修改 OpenCode 即可添加新功能
- ✅ **模块化**: 每个服务器独立开发和维护
- ✅ **语言无关**: 可用任何编程语言实现
- ✅ **标准协议**: 遵循统一的接口规范

### 学习目标

完成本教程后，你将能够：

- ✅ 理解 MCP 协议核心概念
- ✅ 从零实现 MCP 服务器
- ✅ 定义和注册工具
- ✅ 实现资源和提示词
- ✅ 测试和调试 MCP 服务器
- ✅ 将服务器集成到 OpenCode

### 技术栈

- **语言**: TypeScript/Node.js
- **运行时**: Node.js 18+
- **SDK**: `@modelcontextprotocol/sdk`
- **协议版本**: MCP 1.0

---

## MCP 协议

### 协议架构

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenCode (Client)                  │
├─────────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  │ MCP Client   │  │ MCP Client   │  │ MCP Client   │
│  │ (Local)      │  │ (Remote)    │  │ (Remote)    │
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
    │  - File Management Server    │
    │  - Database Server          │
    │  - API Integration Server   │
    └──────────────────────────────┘
```

### 核心概念

#### 1. 工具 (Tools)

MCP 服务器可以定义工具，供 AI 代理调用：

```typescript
{
  name: "tool_name",
  description: "Tool description",
  inputSchema: {
    type: "object",
    properties: {
      param1: { type: "string" }
    }
  }
}
```

#### 2. 资源 (Resources)

资源是服务器提供的数据源，可以被读取和引用：

```typescript
{
  uri: "resource://config",
  name: "Config",
  description: "Application configuration",
  mimeType: "application/json"
}
```

#### 3. 提示词 (Prompts)

提示词是预定义的模板，可以填充参数生成完整的提示词：

```typescript
{
  name: "prompt_name",
  description: "Prompt description",
  arguments: [
    { name: "param1", description: "Parameter description" }
  ]
}
```

#### 4. 传输协议

MCP 支持两种传输协议：

| 协议         | 说明                      | 适用场景   |
| ------------ | ------------------------- | ---------- |
| **Stdio**    | 标准输入/输出通信         | 本地服务器 |
| **HTTP/SSE** | HTTP + Server-Sent Events | 远程服务器 |

### 通信流程

```
1. OpenCode 启动
   ↓
2. 连接 MCP 服务器
   ├─ Local: 通过 stdio 启动进程
   └─ Remote: 通过 HTTP/SSE 连接
   ↓
3. 服务器初始化
   └─ 初始化工具、资源、提示词
   ↓
4. OpenCode 发现能力
   ├─ 列出工具 (listTools)
   ├─ 列出资源 (listResources)
   └─ 列出提示词 (listPrompts)
   ↓
5. AI 代理调用工具
   └─ callTool(name, arguments)
   ↓
6. 服务器执行并返回
   └─ 返回结果或错误
   ↓
7. 重复步骤 5-6
```

---

## 服务器实现

### 项目初始化

创建 MCP 服务器项目：

```bash
# 创建项目目录
mkdir file-management-mcp
cd file-management-mcp

# 初始化项目
npm init -y

# 安装依赖
npm install @modelcontextprotocol/sdk zod
npm install -D typescript tsx @types/node

# 创建 tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts"]
}
EOF

# 创建源代码目录
mkdir -p src
```

### 基础服务器实现

创建 `src/index.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

// 创建 MCP 服务器实例
const server = new McpServer({
  name: "file-management-server",
  version: "1.0.0",
})

// 注册工具
server.tool(
  "list_files",
  {
    description: "列出指定目录中的文件",
    inputSchema: z.object({
      path: z.string().describe("目录路径（相对或绝对）"),
      pattern: z.string().optional().describe("文件模式（如 *.ts）"),
    }).shape,
  },
  async ({ path, pattern }) => {
    try {
      const fs = await import("fs/promises")
      const path = await import("path")

      // 解析路径
      const resolvedPath = path.isAbsolute(path) ? path : path.join(process.cwd(), path)

      // 读取目录
      const files = await fs.readdir(resolvedPath)

      // 过滤模式
      const filteredFiles = pattern
        ? files.filter((f) => {
            const regex = new RegExp(pattern.replace(/\*/g, ".*"))
            return regex.test(f)
          })
        : files

      // 返回结果
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                path: resolvedPath,
                files: filteredFiles,
                count: filteredFiles.length,
              },
              null,
              2,
            ),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `错误: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },
)

// 注册资源
server.resource(
  "file_list",
  "file://current-dir",
  {
    description: "当前目录的文件列表",
    mimeType: "application/json",
  },
  async (uri) => {
    const fs = await import("fs/promises")
    const path = await import("path")

    const files = await fs.readdir(process.cwd())

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(
            {
              cwd: process.cwd(),
              files,
              count: files.length,
            },
            null,
            2,
          ),
        },
      ],
    }
  },
)

// 注册提示词
server.prompt(
  "analyze_directory",
  {
    description: "分析目录结构和内容",
    arguments: [
      {
        name: "path",
        description: "要分析的目录路径",
        required: false,
      },
    ],
  },
  async ({ path }) => {
    const dirPath = path || process.cwd()

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `请分析以下目录的结构和内容：\n${dirPath}\n\n请提供：\n1. 目录结构\n2. 文件统计\n3. 主要文件类型\n4. 潜在的改进建议`,
          },
        },
      ],
    }
  },
)

// 启动服务器
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("File Management MCP Server running on stdio")
}

main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})
```

### 编译和运行

```bash
# 编译
npx tsc

# 运行服务器
node dist/index.js
```

---

## 工具定义

### 工具注册

MCP 服务器通过 `server.tool()` 注册工具：

```typescript
server.tool(
  "tool_name",
  {
    description: "Tool description",
    inputSchema: {
      type: "object",
      properties: {
        param1: {
          type: "string",
          description: "Parameter description",
        },
        param2: {
          type: "number",
          description: "Number parameter",
        },
      },
      required: ["param1"],
    },
  },
  async (params) => {
    // 工具实现
    return {
      content: [
        {
          type: "text",
          text: "Tool result",
        },
      ],
    }
  },
)
```

### 文件管理工具集

创建完整的文件管理工具：

```typescript
// 1. 读取文件
server.tool(
  "read_file",
  {
    description: "读取文件内容",
    inputSchema: z.object({
      path: z.string().describe("文件路径"),
      encoding: z.string().default("utf-8").describe("文件编码"),
    }).shape,
  },
  async ({ path, encoding }) => {
    try {
      const fs = await import("fs/promises")
      const pathModule = await import("path")

      const resolvedPath = pathModule.isAbsolute(path) ? path : pathModule.join(process.cwd(), path)

      const content = await fs.readFile(resolvedPath, encoding as BufferEncoding)

      return {
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `读取文件失败: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },
)

// 2. 写入文件
server.tool(
  "write_file",
  {
    description: "写入内容到文件",
    inputSchema: z.object({
      path: z.string().describe("文件路径"),
      content: z.string().describe("要写入的内容"),
      encoding: z.string().default("utf-8").describe("文件编码"),
    }).shape,
  },
  async ({ path, content, encoding }) => {
    try {
      const fs = await import("fs/promises")
      const pathModule = await import("path")

      const resolvedPath = pathModule.isAbsolute(path) ? path : pathModule.join(process.cwd(), path)

      // 创建目录（如果不存在）
      const dir = pathModule.dirname(resolvedPath)
      await fs.mkdir(dir, { recursive: true })

      // 写入文件
      await fs.writeFile(resolvedPath, content, encoding as BufferEncoding)

      return {
        content: [
          {
            type: "text",
            text: `成功写入文件: ${resolvedPath}`,
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `写入文件失败: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },
)

// 3. 删除文件
server.tool(
  "delete_file",
  {
    description: "删除文件",
    inputSchema: z.object({
      path: z.string().describe("文件路径"),
    }).shape,
  },
  async ({ path }) => {
    try {
      const fs = await import("fs/promises")
      const pathModule = await import("path")

      const resolvedPath = pathModule.isAbsolute(path) ? path : pathModule.join(process.cwd(), path)

      await fs.unlink(resolvedPath)

      return {
        content: [
          {
            type: "text",
            text: `成功删除文件: ${resolvedPath}`,
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `删除文件失败: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },
)

// 4. 创建目录
server.tool(
  "create_directory",
  {
    description: "创建目录",
    inputSchema: z.object({
      path: z.string().describe("目录路径"),
      recursive: z.boolean().default(true).describe("递归创建父目录"),
    }).shape,
  },
  async ({ path, recursive }) => {
    try {
      const fs = await import("fs/promises")
      const pathModule = await import("path")

      const resolvedPath = pathModule.isAbsolute(path) ? path : pathModule.join(process.cwd(), path)

      await fs.mkdir(resolvedPath, { recursive })

      return {
        content: [
          {
            type: "text",
            text: `成功创建目录: ${resolvedPath}`,
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `创建目录失败: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },
)

// 5. 复制文件
server.tool(
  "copy_file",
  {
    description: "复制文件",
    inputSchema: z.object({
      source: z.string().describe("源文件路径"),
      destination: z.string().describe("目标文件路径"),
    }).shape,
  },
  async ({ source, destination }) => {
    try {
      const fs = await import("fs/promises")
      const pathModule = await import("path")

      const resolvedSource = pathModule.isAbsolute(source) ? source : pathModule.join(process.cwd(), source)

      const resolvedDest = pathModule.isAbsolute(destination)
        ? destination
        : pathModule.join(process.cwd(), destination)

      await fs.copyFile(resolvedSource, resolvedDest)

      return {
        content: [
          {
            type: "text",
            text: `成功复制文件: ${resolvedSource} -> ${resolvedDest}`,
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `复制文件失败: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },
)

// 6. 文件统计
server.tool(
  "file_stats",
  {
    description: "获取文件统计信息",
    inputSchema: z.object({
      path: z.string().describe("文件路径"),
    }).shape,
  },
  async ({ path }) => {
    try {
      const fs = await import("fs/promises")
      const pathModule = await import("path")

      const resolvedPath = pathModule.isAbsolute(path) ? path : pathModule.join(process.cwd(), path)

      const stats = await fs.stat(resolvedPath)

      const isDirectory = stats.isDirectory()
      const isFile = stats.isFile()

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                path: resolvedPath,
                type: isDirectory ? "directory" : isFile ? "file" : "other",
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime,
                permissions: stats.mode.toString(8),
              },
              null,
              2,
            ),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `获取文件统计失败: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },
)
```

### 资源定义

注册提供文件系统信息的资源：

```typescript
// 1. 目录列表资源
server.resource(
  "directory_list",
  "file://directory",
  {
    description: "目录的文件列表",
    mimeType: "application/json",
  },
  async (uri) => {
    try {
      const fs = await import("fs/promises")
      const path = await import("path")

      const searchParams = new URL(uri.href).searchParams
      const dirPath = searchParams.get("path") || process.cwd()

      const files = await fs.readdir(dirPath)

      // 获取文件统计
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const fullPath = path.join(dirPath, file)
          const stats = await fs.stat(fullPath)
          return {
            name: file,
            size: stats.size,
            type: stats.isDirectory() ? "directory" : "file",
            modified: stats.mtime,
          }
        }),
      )

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(
              {
                path: dirPath,
                files: fileStats,
                count: files.length,
              },
              null,
              2,
            ),
          },
        ],
      }
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: `错误: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }
    }
  },
)

// 2. 配置资源
server.resource(
  "config",
  "file://config",
  {
    description: "MCP 服务器配置",
    mimeType: "application/json",
  },
  async (uri) => {
    const config = {
      serverName: "file-management-server",
      version: "1.0.0",
      capabilities: {
        tools: ["list_files", "read_file", "write_file", "delete_file", "create_directory", "copy_file", "file_stats"],
        resources: ["directory_list", "config"],
      },
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
```

### 提示词定义

注册预定义的提示词模板：

```typescript
// 1. 目录分析提示词
server.prompt(
  "analyze_directory",
  {
    description: "分析目录结构和内容",
    arguments: [
      {
        name: "path",
        description: "要分析的目录路径",
        required: false,
      },
    ],
  },
  async ({ path }) => {
    const dirPath = path || process.cwd()

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `请分析以下目录的结构和内容：\n${dirPath}\n\n请提供：\n\n` +
              `## 目录结构\n树形结构展示目录层次\n\n` +
              `## 文件统计\n- 总文件数\n- 总目录数\n- 按类型分类\n\n` +
              `## 文件类型\n- 主要的文件类型及其数量\n\n` +
              `## 改进建议\n- 组织结构的建议\n- 命名规范的建议\n`,
          },
        },
      ],
    }
  },
)

// 2. 清理提示词
server.prompt(
  "cleanup_directory",
  {
    description: "清理目录中的临时文件",
    arguments: [
      {
        name: "path",
        description: "要清理的目录路径",
        required: false,
      },
      {
        name: "patterns",
        description: "要删除的文件模式（逗号分隔）",
        required: false,
      },
    ],
  },
  async ({ path, patterns }) => {
    const dirPath = path || process.cwd()
    const filePatterns = patterns || "*.tmp,*.log,.DS_Store,Thumbs.db"

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `请清理以下目录中的临时文件：\n${dirPath}\n\n` +
              `要删除的文件模式：\n${filePatterns}\n\n` +
              `步骤：\n` +
              `1. 使用 list_files 工具列出目录内容\n` +
              `2. 识别匹配模式的文件\n` +
              `3. 使用 delete_file 工具删除文件\n` +
              `4. 报告删除的文件列表\n\n` +
              `注意事项：\n` +
              `- 确认文件确实是临时文件\n` +
              `- 不要删除重要文件\n` +
              `- 报告所有删除操作`,
          },
        },
      ],
    }
  },
)
```

---

## 测试调试

### 使用 MCP Inspector

MCP Inspector 是官方的测试工具：

```bash
# 安装 Inspector
npm install -g @modelcontextprotocol/inspector

# 启动服务器（在另一个终端）
node dist/index.js

# 运行 Inspector
mcp-inspector node dist/index.js
```

Inspector 提供图形界面，可以：

- 查看已注册的工具、资源、提示词
- 手动调用工具
- 查看工具执行结果
- 检查服务器日志

### 单元测试

创建 `test/server.test.ts`:

```typescript
import { describe, it, expect } from "bun:test"

describe("File Management MCP Server", () => {
  it("应该成功初始化服务器", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js")

    const server = new McpServer({
      name: "test-server",
      version: "1.0.0",
    })

    expect(server).toBeDefined()
  })

  it("应该注册工具", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js")
    const { z } = await import("zod")

    const server = new McpServer({
      name: "test-server",
      version: "1.0.0",
    })

    server.tool(
      "test_tool",
      {
        description: "Test tool",
        inputSchema: z.object({
          input: z.string(),
        }).shape,
      },
      async () => ({
        content: [{ type: "text", text: "test" }],
      }),
    )

    expect(server).toBeDefined()
  })
})
```

### 运行测试

```bash
# 使用 Bun 运行测试
bun test

# 或使用 npm
npm test
```

### 手动测试

```bash
# 启动服务器
node dist/index.js

# 在另一个终端使用 OpenCode 测试
opencode

# 在 TUI 中配置 MCP
# 编辑 opencode.json 添加 MCP 服务器
```

### 调试技巧

#### 启用详细日志

```typescript
// 在服务器启动前添加
console.error = (...args) => {
  console.error(`[MCP Server Debug]`, ...args)
}
```

#### 错误处理

```typescript
server.tool(
  "tool_name",
  { description: "...", inputSchema: {...} },
  async (params) => {
    try {
      // 工具逻辑
      return { content: [...] }
    } catch (error) {
      console.error("Tool error:", error)
      return {
        content: [{
          type: "text",
          text: `错误: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      }
    }
  }
)
```

---

## 部署

### 本地部署

#### 1. 配置 OpenCode

编辑 `opencode.json`:

```json
{
  "mcp": {
    "file-management": {
      "type": "local",
      "command": ["node", "/path/to/file-management-mcp/dist/index.js"],
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

#### 2. 验证集成

```bash
# 启动 OpenCode
opencode

# 在 TUI 中查看 MCP 状态
/mcp list

# 应该看到 file-management 已连接
```

#### 3. 测试工具

```bash
# 在 OpenCode TUI 中
列出 src 目录中的文件
```

OpenCode 应该自动调用 MCP 工具 `file-management_list_files`。

### 远程部署

#### 1. 创建 HTTP/SSE 服务器

修改服务器以支持 HTTP 传输：

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"

const server = new McpServer({
  name: "file-management-server",
  version: "1.0.0",
})

// ... 注册工具和资源 ...

// 创建 Express 应用
import express from "express"
import cors from "cors"

const app = express()
app.use(cors())
app.use(express.json())

// MCP 端点
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res)
  await server.connect(transport)
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`)
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`)
})
```

#### 2. 部署到服务器

```bash
# 构建服务器
npx tsc

# 部署到服务器（例如 Vercel、Railway、Heroku）
git push origin main
```

#### 3. 配置 OpenCode 连接

```json
{
  "mcp": {
    "file-management": {
      "type": "remote",
      "url": "https://your-server.com/sse",
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

### Docker 部署

创建 `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

构建和运行：

```bash
# 构建镜像
docker build -t file-management-mcp .

# 运行容器
docker run -p 3000:3000 file-management-mcp
```

---

## 完整示例

### 示例 1: 数据库 MCP 服务器

创建一个提供数据库操作的 MCP 服务器：

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const server = new McpServer({
  name: "database-server",
  version: "1.0.0",
})

// 模拟数据库查询
server.tool(
  "query",
  {
    description: "执行数据库查询",
    inputSchema: z.object({
      sql: z.string().describe("SQL 查询语句"),
      limit: z.coerce.number().default(100).describe("结果限制"),
    }).shape,
  },
  async ({ sql, limit }) => {
    // 实际应用中连接真实数据库
    // 这里使用模拟数据
    const mockResults = [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
    ]

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              sql,
              results: mockResults.slice(0, limit),
              count: mockResults.length,
            },
            null,
            2,
          ),
        },
      ],
    }
  },
)

server.tool(
  "table_info",
  {
    description: "获取数据库表信息",
    inputSchema: z.object({
      table: z.string().describe("表名"),
    }).shape,
  },
  async ({ table }) => {
    const tableInfo = {
      name: table,
      columns: [
        { name: "id", type: "integer", primary: true },
        { name: "name", type: "varchar(255)" },
        { name: "created_at", type: "timestamp" },
      ],
      rowCount: 1000,
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(tableInfo, null, 2),
        },
      ],
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
```

### 示例 2: API 集成 MCP 服务器

创建一个集成外部 API 的 MCP 服务器：

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const server = new McpServer({
  name: "api-integration-server",
  version: "1.0.0",
})

// API 调用工具
server.tool(
  "api_request",
  {
    description: "调用外部 API",
    inputSchema: z.object({
      endpoint: z.string().describe("API 端点"),
      method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
      params: z.record(z.string()).optional().describe("请求参数"),
    }).shape,
  },
  async ({ endpoint, method, params }) => {
    try {
      const url = new URL(`https://api.example.com/${endpoint}`)

      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value))
        })
      }

      const response = await fetch(url.toString(), { method })

      const data = await response.json()

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `API 错误: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
```

---

## 最佳实践

### 工具设计

#### ✅ 良好实践

```typescript
server.tool(
  "read_file",
  {
    description: "读取文件内容，支持多种编码格式",
    inputSchema: z.object({
      path: z.string().describe("文件路径"),
      encoding: z.string().default("utf-8").describe("文件编码：utf-8, base64, ascii"),
    }).shape,
  },
  async ({ path, encoding }) => {
    // 清晰的参数验证
    if (!path) {
      return {
        content: [{ type: "text", text: "错误: 路径是必需的" }],
        isError: true,
      }
    }

    // 实现逻辑
    // 返回结构化结果
  },
)
```

#### ❌ 避免的实践

```typescript
server.tool(
  "bad_tool",
  {
    description: "模糊的描述",
    inputSchema: {
      /* 缺少描述 */
    },
  },
  async () => {
    // 没有错误处理
    // 返回非结构化数据
  },
)
```

### 错误处理

#### ✅ 良好实践

```typescript
try {
  const result = await riskyOperation()
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
  }
} catch (error) {
  console.error("Operation failed:", error)

  return {
    content: [
      {
        type: "text",
        text: `操作失败: ${error instanceof Error ? error.message : String(error)}`,
      },
    ],
    isError: true,
  }
}
```

### 性能优化

#### 1. 异步操作

```typescript
// 使用 Promise.all 进行并行操作
const results = await Promise.all([readFile(file1), readFile(file2), readFile(file3)])
```

#### 2. 缓存

```typescript
const cache = new Map()

server.tool(
  "cached_tool",
  {
    // ... config
  },
  async ({ key }) => {
    if (cache.has(key)) {
      return { content: [{ type: "text", text: cache.get(key) }] }
    }

    const result = await expensiveOperation(key)
    cache.set(key, result)

    return { content: [{ type: "text", text: result }] }
  },
)
```

#### 3. 流式处理

```typescript
server.tool(
  "stream_file",
  {
    description: "流式读取大文件",
    inputSchema: z.object({
      path: z.string(),
    }).shape,
  },
  async ({ path }) => {
    const fs = await import("fs")
    const stream = fs.createReadStream(path)

    // 使用流而不是一次性读取
    // ...
  },
)
```

### 安全性

#### 1. 路径验证

```typescript
const path = await import("path")

function validatePath(filePath: string): boolean {
  const resolved = path.resolve(filePath)
  const cwd = process.cwd()

  // 检查路径是否在当前工作目录内
  return resolved.startsWith(cwd)
}

server.tool(
  "read_file",
  {
    // ...
  },
  async ({ path }) => {
    if (!validatePath(path)) {
      return {
        content: [{ type: "text", text: "错误: 不允许访问该路径" }],
        isError: true,
      }
    }

    // ...
  },
)
```

#### 2. 输入净化

```typescript
function sanitizeInput(input: string): string {
  // 移除危险字符
  return input.replace(/[<>]/g, "").replace(/\.\./g, "")
}
```

#### 3. 资源限制

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

server.tool(
  "read_file",
  {
    // ...
  },
  async ({ path }) => {
    const stats = await fs.stat(path)

    if (stats.size > MAX_FILE_SIZE) {
      return {
        content: [{ type: "text", text: "错误: 文件太大" }],
        isError: true,
      }
    }

    // ...
  },
)
```

### 监控和日志

```typescript
// 添加使用统计
const stats = {
  toolCalls: {} as Record<string, number>,
}

server.tool(
  "any_tool",
  {
    // ...
  },
  async (params) => {
    // 记录调用
    stats.toolCalls["any_tool"] = (stats.toolCalls["any_tool"] || 0) + 1

    const startTime = Date.now()

    // ... 执行逻辑

    const duration = Date.now() - startTime

    console.log(
      JSON.stringify({
        tool: "any_tool",
        duration,
        params,
        success: true,
      }),
    )

    // ...
  },
)
```

---

## 总结

本教程介绍了从零开始创建 MCP 服务器的完整流程：

✅ **MCP 协议**: 理解 MCP 的核心概念和通信流程
✅ **服务器实现**: 创建和配置 MCP 服务器
✅ **工具定义**: 注册和使用 MCP 工具
✅ **测试调试**: 使用 MCP Inspector 和单元测试
✅ **部署**: 本地和远程部署方式

### 下一步

- 学习[从零开发新工具](./37-从零开发新工具.md)
- 了解[创建自定义代理](./38-创建自定义代理.md)
- 探索[添加新的 AI 提供商](./40-添加新的AI提供商.md)
- 查看[MCP 官方文档](https://modelcontextprotocol.io)

---

_文档版本：1.0.0_
_最后更新：2026-01-22_
_相关文档：[05-MCP集成详解.md](./05-MCP集成详解.md) | [27-插件系统详解.md](./27-插件系统详解.md) | [32-安全最佳实践.md](./32-安全最佳实践.md)_
