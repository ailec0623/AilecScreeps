/**
 * 全局缓存系统
 * 缓存常用计算结果，避免重复计算
 * 参考Overmind的GlobalCache ($)实现
 */

const CACHE_TIMEOUT = 50;
const SHORT_CACHE_TIMEOUT = 10;

// 内部缓存对象
const _cache = {
    structures: {},
    numbers: {},
    roomPositions: {},
    lists: {},
    costMatrices: {},
    things: {},
    expiration: {},
    accessed: {}
};

/**
 * 获取缓存过期时间（带随机性，避免同时过期）
 * @param {number} baseTimeout - 基础过期时间
 * @param {number} variance - 随机变化范围
 * @returns {number} 过期时间
 */
function getCacheExpiration(baseTimeout, variance = 0) {
    const random = variance > 0 ? Math.floor(Math.random() * variance) : 0;
    return Game.time + baseTimeout + random;
}

class GlobalCache {
    /**
     * 缓存结构列表
     * @param {Object} saver - 保存者对象（需要有ref属性）
     * @param {string} key - 缓存键
     * @param {Function} callback - 计算函数
     * @param {number} timeout - 过期时间（tick数）
     * @returns {Array<Structure>} 结构列表
     */
    static structures(saver, key, callback, timeout = CACHE_TIMEOUT) {
        const cacheKey = saver.ref + 's' + key;
        if (!_cache.structures[cacheKey] || Game.time > _cache.expiration[cacheKey]) {
            // 缓存过期或不存在，重新计算
            _cache.structures[cacheKey] = callback();
            _cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
        } else {
            // 刷新结构列表（通过ID转换为对象）
            if ((_cache.accessed[cacheKey] || 0) < Game.time) {
                _cache.structures[cacheKey] = _cache.structures[cacheKey]
                    .filter(s => s && Game.getObjectById(s.id))
                    .map(s => Game.getObjectById(s.id));
                _cache.accessed[cacheKey] = Game.time;
            }
        }
        return _cache.structures[cacheKey];
    }

    /**
     * 缓存数字
     * @param {Object} saver - 保存者对象
     * @param {string} key - 缓存键
     * @param {Function} callback - 计算函数
     * @param {number} timeout - 过期时间
     * @returns {number} 缓存的数字
     */
    static number(saver, key, callback, timeout = SHORT_CACHE_TIMEOUT) {
        const cacheKey = saver.ref + '#' + key;
        if (_cache.numbers[cacheKey] === undefined || Game.time > _cache.expiration[cacheKey]) {
            _cache.numbers[cacheKey] = callback();
            _cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
        }
        return _cache.numbers[cacheKey];
    }

    /**
     * 缓存位置
     * @param {Object} saver - 保存者对象
     * @param {string} key - 缓存键
     * @param {Function} callback - 计算函数
     * @param {number} timeout - 过期时间
     * @returns {RoomPosition|undefined} 缓存的位置
     */
    static pos(saver, key, callback, timeout = CACHE_TIMEOUT) {
        const cacheKey = saver.ref + 'p' + key;
        if (_cache.roomPositions[cacheKey] === undefined || Game.time > _cache.expiration[cacheKey]) {
            _cache.roomPositions[cacheKey] = callback();
            if (!timeout) timeout = CACHE_TIMEOUT;
            _cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
        }
        return _cache.roomPositions[cacheKey];
    }

    /**
     * 缓存列表
     * @param {Object} saver - 保存者对象
     * @param {string} key - 缓存键
     * @param {Function} callback - 计算函数
     * @param {number} timeout - 过期时间
     * @returns {Array} 缓存的列表
     */
    static list(saver, key, callback, timeout = CACHE_TIMEOUT) {
        const cacheKey = saver.ref + 'l' + key;
        if (_cache.lists[cacheKey] === undefined || Game.time > _cache.expiration[cacheKey]) {
            _cache.lists[cacheKey] = callback();
            _cache.expiration[cacheKey] = getCacheExpiration(timeout, Math.ceil(timeout / 10));
        }
        return _cache.lists[cacheKey];
    }

    /**
     * 清理过期缓存（可选，用于内存管理）
     */
    static cleanExpired() {
        const currentTime = Game.time;
        for (const key in _cache.expiration) {
            if (currentTime > _cache.expiration[key]) {
                // 清理所有相关的缓存
                delete _cache.structures[key];
                delete _cache.numbers[key];
                delete _cache.roomPositions[key];
                delete _cache.lists[key];
                delete _cache.costMatrices[key];
                delete _cache.things[key];
                delete _cache.accessed[key];
                delete _cache.expiration[key];
            }
        }
    }
}

module.exports = GlobalCache;
