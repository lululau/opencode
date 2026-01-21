# Instance 模块详解

`Instance` 模块是 Opencode 核心架构中用于管理 **项目实例上下文 (Project Instance Context)** 的关键组件。它通过封装 `AsyncLocalStorage` 机制，确保在异步执行流中能够安全地访问当前正在操作的项目相关信息（如路径、工作树、元数据等）。

## 核心概念

在 Opencode 中，一个“实例”代表一个打开的项目目录。由于系统可能同时或交替处理多个项目，`Instance` 模块提供了一种“依赖注入”式的上下文管理方案，避免了在函数调用链中层层传递项目路径。

## 类型定义

### Context 接口
```typescript
interface Context {
  directory: string   // 项目的根目录路径
  worktree: string    // 项目的工作树/沙盒路径
  project: Project.Info // 项目的元数据信息（来自 Project.fromDirectory）
}
```

## 主要方法与属性

### 1. `Instance.provide<R>(input, fn)`
这是进入项目上下文的入口方法。

*   **参数**:
    *   `input.directory`: 项目目录。
    *   `input.init`: (可选) 初始化回调函数。
    *   `input.fn`: 需要在上下文内执行的业务逻辑函数。
*   **功能**: 
    1.  检查缓存中是否已有该目录的实例，如果没有则调用 `Project.fromDirectory` 创建。
    2.  设置异步上下文。
    3.  如果是首次创建，执行 `init` 回调。
    4.  执行并返回 `fn` 的结果。

### 2. 上下文访问器 (Getters)
这些属性必须在 `Instance.provide` 的作用域内调用，否则会抛出 `NotFound` 异常。

*   **`Instance.directory`**: 获取当前上下文的项目根目录。
*   **`Instance.worktree`**: 获取当前项目的工作树路径（通常用于代码操作的隔离环境）。
*   **`Instance.project`**: 获取项目的详细信息（如语言、配置等）。

### 3. `Instance.containsPath(filepath)`
判断一个文件路径是否属于当前项目。

*   **逻辑**: 如果路径在 `directory` 下，或者处于 `worktree` 内，则返回 `true`。
*   **安全提示**: 该方法会自动处理非 Git 项目将 `worktree` 设置为 `/` 的特殊情况，防止误判。

### 4. `Instance.state<S>(init, dispose)`
与 `State` 模块集成，创建与当前实例绑定的状态。

*   **功能**: 返回一个函数，该函数会根据当前的 `Instance.directory` 自动隔离状态存储。
*   **用途**: 用于在复杂的代理任务中维持单例状态，且该状态随实例生命周期管理。

### 5. 生命周期管理
*   **`Instance.dispose()`**: 销毁当前上下文对应的实例，清理 `State` 缓存并发出 `server.instance.disposed` 全局事件。
*   **`Instance.disposeAll()`**: 清理所有已缓存的项目实例，通常在系统关闭时使用。

## 内部实现细节

*   **缓存机制**: 使用 `Map<string, Promise<Context>>` 缓存实例，确保同一个目录并发调用 `provide` 时不会重复初始化。
*   **异步上下文**: 基于 `src/util/context.ts` 封装的 `AsyncLocalStorage` 实现，保证了在 `await` 之后依然能获取正确的上下文。

## 使用示例

```typescript
import { Instance } from "./project/instance"

await Instance.provide({ directory: "/my/project" }, async () => {
  // 这里的代码块处于 "/my/project" 的上下文中
  console.log(Instance.directory); // 输出: /my/project
  
  const files = Instance.containsPath("/my/project/src/index.ts"); // true
  
  // 执行业务逻辑...
});
```
