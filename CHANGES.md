# OpenAI baseURL 配置支持

本文档记录了为支持在配置文件中自定义 OpenAI provider 的 baseURL 所做的修改。

## 修改的文件

### 1. `internal/config/config.go`
- 扩展 `Provider` 结构体，添加了 `BaseURL` 字段
- 新字段支持 JSON 序列化，使用 `omitempty` 标记

```go
type Provider struct {
    APIKey   string `json:"apiKey"`
    BaseURL  string `json:"baseURL,omitempty"`  // 新增字段
    Disabled bool   `json:"disabled"`
}
```

### 2. `cmd/schema/main.go`
- 在配置 schema 生成器中添加了 `baseURL` 字段的定义
- 为字段添加了适当的描述信息

### 3. `internal/llm/agent/agent.go`
- 修改 `createAgentProvider` 函数，支持使用配置中的自定义 baseURL
- 优化了 OpenAI options 的处理逻辑，统一处理 baseURL 和 reasoning effort

### 4. `README.md`
- 更新了配置文件结构示例，包含 baseURL 字段
- 添加了专门的章节说明如何配置自定义 OpenAI baseURL
- 提供了使用场景说明

### 5. `opencode-schema.json`
- 重新生成了配置 schema 文件，包含新的 baseURL 字段定义

### 6. `example-config.json`
- 创建了示例配置文件，展示如何使用新功能

## 功能说明

新功能允许用户在配置文件中为 OpenAI provider 指定自定义的 baseURL，特别适用于：

- 自托管的 OpenAI 兼容模型（如 Ollama、LM Studio 等）
- 代理的 OpenAI API 端点
- 自定义 OpenAI API 实现（如阿里云 DashScope）

---

# Qwen Plus 模型支持

## 新增功能

添加了对阿里云 DashScope 的 `qwen-plus` 模型的支持。

## 修改的文件

### 1. `internal/llm/models/openai.go`
- 添加了 `QwenPlus` 模型常量定义
- 在 `OpenAIModels` 映射中添加了完整的模型配置

```go
const (
    // ... 其他模型
    QwenPlus     ModelID = "qwen-plus"
)

var OpenAIModels = map[ModelID]Model{
    // ... 其他模型
    QwenPlus: {
        ID:                  QwenPlus,
        Name:                "Qwen Plus",
        Provider:            ProviderOpenAI,
        APIModel:            "qwen-plus",
        CostPer1MIn:         2.00,
        CostPer1MInCached:   0.50,
        CostPer1MOutCached:  0.0,
        CostPer1MOut:        8.00,
        ContextWindow:       1_000_000,
        DefaultMaxTokens:    8000,
        SupportsAttachments: true,
    },
}
```

### 2. `opencode-schema.json`
- 重新生成了配置 schema，包含 `qwen-plus` 模型选项

### 3. `README.md`
- 在 OpenAI 模型列表中添加了 Qwen Plus 模型

### 4. `example-config.json`
- 更新示例配置，展示如何使用 qwen-plus 模型配合阿里云 DashScope

## 使用方法

```json
{
  "providers": {
    "openai": {
      "apiKey": "your-dashscope-api-key",
      "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "disabled": false
    }
  },
  "agents": {
    "coder": {
      "model": "qwen-plus",
      "maxTokens": 5000
    },
    "task": {
      "model": "qwen-plus",
      "maxTokens": 5000
    },
    "title": {
      "model": "qwen-plus",
      "maxTokens": 80
    }
  }
}
```

## 模型特性

- **上下文窗口**: 1,000,000 tokens
- **默认最大输出**: 8,000 tokens
- **支持附件**: 是
- **支持推理**: 否
- **Provider**: OpenAI (通过自定义 baseURL)

## 向后兼容性

- 所有修改都是向后兼容的
- 如果不指定 `baseURL`，系统将使用默认的 OpenAI API 端点
- 现有配置文件无需修改即可继续工作

## 测试

- 代码编译成功，没有语法错误
- Schema 文件生成正确，包含新字段定义
- 配置结构正确处理新字段的序列化和反序列化

---

# 修复空 tools 数组问题

## 问题描述

当 tools 为空时，qwen-plus 等某些模型会返回错误：`"[] is too short - 'tools"`，因为这些模型不接受空数组作为 tools 的值。

## 解决方案

修改了 OpenAI provider 的请求构建逻辑，当 tools 为空时完全去掉 tools 字段，而不是发送空数组。

## 修改的文件

### 1. `internal/llm/provider/openai.go`
- 修改 `preparedParams` 方法，只有在 tools 不为空时才设置 Tools 字段

```go
func (o *openaiClient) preparedParams(messages []openai.ChatCompletionMessageParamUnion, tools []openai.ChatCompletionToolParam) openai.ChatCompletionNewParams {
    params := openai.ChatCompletionNewParams{
        Model:    openai.ChatModel(o.providerOptions.model.APIModel),
        Messages: messages,
    }

    // Only set Tools if there are any tools to avoid sending empty array
    if len(tools) > 0 {
        params.Tools = tools
    }

    // ... 其他参数设置
}
```

## 修复效果

- ✅ 解决了 qwen-plus 模型的空 tools 数组错误
- ✅ 对其他模型保持兼容性
- ✅ 符合 OpenAI API 规范（tools 字段是可选的）

## 测试验证

使用测试配置文件 `test-qwen-config.json` 验证修复效果，确保不再出现 "[] is too short - 'tools'" 错误。 