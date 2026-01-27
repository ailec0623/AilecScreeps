# 构建说明

## 概述

由于 Screeps 不支持从文件夹内 import 文件，我们需要使用构建脚本将所有 `src/` 文件夹中的文件打包成一个 `main.js` 文件。

## 使用方法

### 构建

运行构建脚本：

```bash
node build.js
```

或者使用 npm：

```bash
npm run build
```

### 构建过程

1. 扫描 `src/` 目录中的所有 `.js` 文件
2. 从 `src/main.js` 开始，递归解析所有依赖
3. 将所有内部模块内联到一个 `main.js` 文件中
4. 使用模块系统包装每个模块，避免作用域冲突
5. 保持外部 `require()` 不变（如 `require('tool')`, `require('role.config')` 等）

### 文件结构

**源代码（src/）：**
```
src/
├── main.js
├── core/
│   ├── Logger.js
│   ├── ErrorHandler.js
│   └── MemoryManager.js
├── colony/
│   └── ColonyManager.js
├── spawn/
│   ├── SpawnManager.js
│   └── ...
└── ...
```

**构建后：**
```
.
├── main.js          # 所有代码打包在一个文件中
└── [其他旧文件保留]
```

## 模块系统

构建后的 `main.js` 使用简单的模块系统：

```javascript
// 模块系统
const modules = {};

// 每个模块都被包装在 IIFE 中
(function() {
  const exports = {};
  // 模块代码
  // require('./core/Logger') 被替换为 modules['core/Logger']
  modules['core/Logger'] = exports;
})();

// 主入口
const logger = modules['core/Logger'];
// ...
```

## 开发流程

1. **编辑源代码**：在 `src/` 目录中编辑文件
2. **运行构建**：执行 `node build.js`
3. **上传到 Screeps**：只上传 `main.js` 文件

## 注意事项

1. **不要直接编辑根目录的 `main.js`**，它会被构建脚本覆盖
2. **所有新代码应该在 `src/` 目录中**
3. **外部模块**（如 `require('tool')`）保持不变，需要在根目录存在
4. **构建后的 `main.js` 包含所有内部模块**，只需要上传这一个文件

## 与 Overmind 的对比

Overmind 使用 Rollup 将所有 TypeScript 文件打包成一个 `main.js`。我们的方法类似：
- 将所有 JavaScript 文件打包成一个 `main.js`
- 使用简单的模块系统避免作用域冲突
- 保持外部依赖不变
