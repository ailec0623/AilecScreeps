/**
 * 构建脚本
 * 将所有 src 文件夹中的文件打包成一个 main.js
 * 将所有内部模块内联，保持外部 require 不变
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const OUTPUT_FILE = path.join(__dirname, 'main.js');
const MAIN_FILE = path.join(SRC_DIR, 'main.js');

// 存储模块信息
const modules = new Map();
const processed = new Set();

/**
 * 将文件路径转换为模块 ID
 */
function getModuleId(filePath) {
    const relative = path.relative(SRC_DIR, filePath);
    return relative.replace(/\\/g, '/').replace(/\.js$/, '');
}

/**
 * 解析 require 路径
 */
function resolveRequire(requirePath, fromFile) {
    // 相对路径
    if (requirePath.startsWith('./') || requirePath.startsWith('../')) {
        const fromDir = path.dirname(fromFile);
        const resolved = path.resolve(fromDir, requirePath);
        if (fs.existsSync(resolved + '.js')) {
            return resolved + '.js';
        }
        if (fs.existsSync(resolved)) {
            return resolved;
        }
    }
    
    // src/ 开头的路径
    if (requirePath.startsWith('src/')) {
        const resolved = path.join(__dirname, requirePath);
        if (fs.existsSync(resolved + '.js')) {
            return resolved + '.js';
        }
        if (fs.existsSync(resolved)) {
            return resolved;
        }
    }

    return null; // 外部模块或未找到
}

/**
 * 处理文件，收集所有依赖
 */
function processFile(filePath) {
    const normalized = path.normalize(filePath);
    
    if (processed.has(normalized) || !fs.existsSync(normalized)) {
        return;
    }

    processed.add(normalized);
    const content = fs.readFileSync(normalized, 'utf8');
    const moduleId = getModuleId(normalized);
    
    // 解析所有 require
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const dependencies = [];
    let match;
    const contentCopy = content;

    while ((match = requireRegex.exec(contentCopy)) !== null) {
        const reqPath = match[1];
        const resolved = resolveRequire(reqPath, normalized);
        
        if (resolved && resolved.startsWith(SRC_DIR)) {
            const depId = getModuleId(resolved);
            dependencies.push({
                original: reqPath,
                resolved: resolved,
                moduleId: depId
            });
            // 递归处理依赖
            processFile(resolved);
        }
    }

    modules.set(moduleId, {
        id: moduleId,
        path: normalized,
        content: content,
        dependencies: dependencies
    });
}

/**
 * 替换模块内容中的 require
 */
function replaceRequires(content, module) {
    let result = content;
    
    for (const dep of module.dependencies) {
        // 转义特殊字符
        const escaped = dep.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`require\\s*\\(\\s*['"]${escaped}['"]\\s*\\)`, 'g');
        result = result.replace(regex, `modules['${dep.moduleId}']`);
    }
    
    return result;
}

/**
 * 生成模块代码（内联所有依赖）
 */
function generateModuleCode(moduleId, visited = new Set(), generated = new Set()) {
    if (visited.has(moduleId)) {
        return ''; // 避免循环依赖
    }
    if (generated.has(moduleId)) {
        return ''; // 已经生成过，避免重复
    }
    visited.add(moduleId);

    const module = modules.get(moduleId);
    if (!module) {
        return '';
    }

    let code = '';
    
    // 先处理依赖（按依赖顺序）
    for (const dep of module.dependencies) {
        code += generateModuleCode(dep.moduleId, visited, generated);
    }

    // 标记为已生成
    generated.add(moduleId);
    visited.delete(moduleId);

    // 生成当前模块代码
    let moduleContent = replaceRequires(module.content, module);

    // 替换 module.exports
    moduleContent = moduleContent.replace(/module\.exports\s*=/g, 'exports =');

    // 生成模块包装器
    code += `\n// ===== Module: ${moduleId} =====\n`;
    code += `(function() {\n`;
    code += `  let exports = {};\n`;
    // 保持原有缩进，但整体缩进一级
    const lines = moduleContent.split('\n');
    code += lines.map(line => {
        if (line.trim() === '') return '';
        return '  ' + line;
    }).join('\n');
    code += `\n  modules['${moduleId}'] = exports;\n`;
    code += `})();\n`;

    return code;
}

/**
 * 生成主文件代码
 */
function generateMainCode() {
    const mainModule = modules.get('main');
    if (!mainModule) {
        throw new Error('main.js not found in src/');
    }

    let mainContent = replaceRequires(mainModule.content, mainModule);

    // 替换 module.exports
    mainContent = mainContent.replace(/module\.exports\s*=/g, 'exports =');

    return mainContent;
}

/**
 * 拓扑排序模块（确保依赖顺序正确）
 */
function topologicalSort() {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    function visit(moduleId) {
        if (visiting.has(moduleId)) {
            // 循环依赖检测
            return;
        }
        if (visited.has(moduleId)) {
            return;
        }

        visiting.add(moduleId);
        const module = modules.get(moduleId);
        if (module) {
            // 先访问依赖
            for (const dep of module.dependencies) {
                visit(dep.moduleId);
            }
        }
        visiting.delete(moduleId);
        visited.add(moduleId);
        if (moduleId !== 'main') {
            sorted.push(moduleId);
        }
    }

    // 从 main 开始
    visit('main');

    return sorted;
}

/**
 * 主构建函数
 */
function build() {
    console.log('Starting build...');
    console.log(`Source: ${SRC_DIR}`);
    console.log(`Output: ${OUTPUT_FILE}\n`);

    if (!fs.existsSync(MAIN_FILE)) {
        throw new Error('src/main.js not found!');
    }

    // 处理所有文件（从 main.js 开始）
    console.log('Processing files...');
    processFile(MAIN_FILE);

    console.log(`Found ${modules.size} modules\n`);

    // 生成模块系统代码
    const header = `/**
 * Screeps 主循环入口
 * 此文件由 build.js 自动生成
 * 请勿直接编辑此文件，编辑 src/ 中的文件后运行: node build.js
 * 
 * 生成时间: ${new Date().toISOString()}
 */

// 模块系统
const modules = {};

`;

    // 生成所有模块代码（除了 main）
    // 策略：完全依赖 generateModuleCode 的递归处理，从 main 的依赖开始
    // generateModuleCode 会确保依赖在使用它们的模块之前生成
    let modulesCode = '';
    const generated = new Set();
    
    // 从 main 模块开始，递归生成所有依赖
    const mainModule = modules.get('main');
    if (mainModule) {
        // 生成 main 的所有直接依赖
        // generateModuleCode 会递归处理每个依赖的依赖，确保正确的顺序
        for (const dep of mainModule.dependencies) {
            const code = generateModuleCode(dep.moduleId, new Set(), generated);
            if (code) {
                modulesCode += code;
            }
        }
    }
    
    // 确保所有模块都被生成（处理可能遗漏的模块）
    // 这些模块可能没有被 main 直接或间接引用
    for (const [moduleId, module] of modules) {
        if (moduleId !== 'main' && !generated.has(moduleId)) {
            const code = generateModuleCode(moduleId, new Set(), generated);
            if (code) {
                modulesCode += code;
            }
        }
    }

    // 生成主代码
    const mainCode = generateMainCode();

    // 合并所有代码
    const output = header + modulesCode + '\n// ===== Main Entry =====\n' + mainCode;

    // 写入文件
    fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
    
    console.log(`Build completed!`);
    console.log(`Output: ${OUTPUT_FILE}`);
    console.log(`Processed ${modules.size} modules`);
    console.log(`\nYou can now upload main.js to Screeps.`);
}

// 运行构建
try {
    build();
} catch (error) {
    console.error('Build failed:', error);
    console.error(error.stack);
    process.exit(1);
}
