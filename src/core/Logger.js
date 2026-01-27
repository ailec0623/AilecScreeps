/**
 * 日志系统
 * 支持不同日志级别：DEBUG, INFO, WARN, ERROR
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

class Logger {
    constructor() {
        this.level = LOG_LEVELS.DEBUG; // 默认级别改为 DEBUG 以便调试
        this.enabled = true;
    }

    /**
     * 设置日志级别
     * @param {string} level - DEBUG, INFO, WARN, ERROR
     */
    setLevel(level) {
        if (LOG_LEVELS[level] !== undefined) {
            this.level = LOG_LEVELS[level];
        }
    }

    /**
     * 启用/禁用日志
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * 记录日志
     * @param {number} level - 日志级别
     * @param {string} message - 日志消息
     * @param {...any} args - 额外参数
     */
    log(level, message, ...args) {
        if (!this.enabled || level < this.level) {
            return;
        }

        const timestamp = Game.time;
        const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
        const prefix = `[${timestamp}] [${levelName}]`;

        if (args.length > 0) {
            console.log(prefix, message, ...args);
        } else {
            console.log(prefix, message);
        }
    }

    debug(message, ...args) {
        this.log(LOG_LEVELS.DEBUG, message, ...args);
    }

    info(message, ...args) {
        this.log(LOG_LEVELS.INFO, message, ...args);
    }

    warn(message, ...args) {
        this.log(LOG_LEVELS.WARN, message, ...args);
    }

    error(message, ...args) {
        this.log(LOG_LEVELS.ERROR, message, ...args);
    }
}

// 导出单例
const logger = new Logger();
module.exports = logger;
