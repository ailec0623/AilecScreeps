/**
 * 统一错误处理机制
 */

const logger = require('./Logger');

class ErrorHandler {
    /**
     * 处理错误
     * @param {Error} error - 错误对象
     * @param {string} context - 错误上下文
     * @param {Object} additionalInfo - 额外信息
     */
    static handle(error, context = 'Unknown', additionalInfo = {}) {
        const errorMessage = error.message || String(error);
        const errorStack = error.stack || 'No stack trace';

        logger.error(`Error in ${context}:`, errorMessage);
        logger.debug(`Stack trace:`, errorStack);

        if (Object.keys(additionalInfo).length > 0) {
            logger.debug('Additional info:', additionalInfo);
        }

        // 可以在这里添加错误上报、恢复机制等
    }

    /**
     * 安全执行函数，捕获错误
     * @param {Function} fn - 要执行的函数
     * @param {string} context - 上下文
     * @param {*} defaultValue - 出错时的默认返回值
     * @returns {*} 函数返回值或默认值
     */
    static safeExecute(fn, context = 'Unknown', defaultValue = null) {
        try {
            return fn();
        } catch (error) {
            this.handle(error, context);
            return defaultValue;
        }
    }

    /**
     * 异步安全执行
     * @param {Function} fn - 异步函数
     * @param {string} context - 上下文
     * @param {*} defaultValue - 出错时的默认返回值
     * @returns {Promise} Promise 对象
     */
    static async safeExecuteAsync(fn, context = 'Unknown', defaultValue = null) {
        try {
            return await fn();
        } catch (error) {
            this.handle(error, context);
            return defaultValue;
        }
    }
}

module.exports = ErrorHandler;
