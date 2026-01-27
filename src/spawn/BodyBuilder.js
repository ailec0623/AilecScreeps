/**
 * 身体部件构建器
 * 根据能量和配置构建最优的身体部件组合
 */

const CostCalculator = require('./CostCalculator');

class BodyBuilder {
    /**
     * 构建自动组装身体（根据可用能量动态调整）
     * @param {Object} config - 角色配置
     * @param {number} availableEnergy - 可用能量
     * @param {Room} room - 房间对象（可选，用于检查 extension 能量）
     * @returns {Array<string>} 身体部件数组
     */
    static buildAutoBody(config, availableEnergy, room = null) {
        if (!config.auto) {
            return null;
        }

        const base = config.auto.base || [];
        const extend = config.auto.extend || [];
        const maxExtendTimes = config.auto.max || 50; // 最大扩展次数
        
        // 计算身体部件总数上限（Screeps 硬限制是 50，但也要考虑配置中的 max）
        // maxExtendTimes 是扩展次数，所以总部件数 = base.length + extend.length * maxExtendTimes
        const maxTotalParts = Math.min(50, base.length + extend.length * maxExtendTimes);

        // 计算基础成本
        const baseCost = CostCalculator.calculateCost(base);
        const extendCost = CostCalculator.calculateCost(extend);

        // 检查 extension 是否有能量，如果有则更积极地使用能量
        let energyBuffer = 0.2; // 默认预留 20% 缓冲
        if (room) {
            const extensions = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_EXTENSION
            });
            const extensionEnergy = extensions.reduce((sum, ext) => sum + ext.store.getUsedCapacity(RESOURCE_ENERGY), 0);
            const extensionCapacity = extensions.reduce((sum, ext) => sum + ext.store.getCapacity(RESOURCE_ENERGY), 0);
            
            // 如果 extension 有超过 50% 的能量，减少缓冲，更积极地使用能量
            if (extensionCapacity > 0 && extensionEnergy / extensionCapacity > 0.5) {
                energyBuffer = 0.1; // 只预留 10% 缓冲
            }
            // 如果 extension 能量充足（超过 80%），进一步减少缓冲
            if (extensionCapacity > 0 && extensionEnergy / extensionCapacity > 0.8) {
                energyBuffer = 0.05; // 只预留 5% 缓冲
            }
        }

        // 根据 extension 能量情况调整可用能量
        const usableEnergy = Math.min(availableEnergy * (1 - energyBuffer), 6000);
        const restEnergy = usableEnergy - baseCost;

        if (restEnergy < 0) {
            // 能量不足，返回最小配置
            return this.buildMinimalBody(base);
        }

        // 计算可以添加的扩展数量（不超过配置的最大扩展次数和总部件数上限）
        let body = [...base];
        const maxExtendsByEnergy = Math.floor(restEnergy / extendCost);
        const maxExtendsByConfig = maxExtendTimes;
        const maxExtendsByParts = Math.floor((maxTotalParts - base.length) / extend.length);
        
        const maxExtends = Math.min(
            maxExtendsByEnergy,
            maxExtendsByConfig,
            maxExtendsByParts
        );

        for (let i = 0; i < maxExtends; i++) {
            if (body.length >= maxTotalParts) break; // 不超过总部件数上限
            body = body.concat(extend);
        }

        // 如果能量仍然不足，逐步减少部件
        let bodyCost = CostCalculator.calculateCost(body);
        while (bodyCost > availableEnergy && body.length > base.length) {
            // 移除最后一个扩展
            body.splice(-extend.length);
            bodyCost = CostCalculator.calculateCost(body);
        }

        return body.length > 0 ? body : this.buildMinimalBody(base);
    }

    /**
     * 构建最小配置身体
     * @param {Array<string>} base - 基础部件
     * @returns {Array<string>} 最小身体部件数组
     */
    static buildMinimalBody(base) {
        // 确保至少有一个 MOVE
        if (base.length === 0) {
            return [MOVE];
        }
        return base.filter(part => part === MOVE || part === WORK || part === CARRY).length > 0 
            ? base 
            : [MOVE];
    }

    /**
     * 构建标准身体（使用固定配置）
     * @param {Object} config - 角色配置
     * @param {number} controllerLevel - 控制器等级
     * @param {number} availableEnergy - 可用能量
     * @returns {Array<string>} 身体部件数组
     */
    static buildStandardBody(config, controllerLevel, availableEnergy) {
        if (!config[controllerLevel] || !config[controllerLevel].mod) {
            // 降级到上一级
            const fallbackLevel = Math.max(1, controllerLevel - 1);
            if (config[fallbackLevel] && config[fallbackLevel].mod) {
                return this.buildStandardBody(config, fallbackLevel, availableEnergy);
            }
            return null;
        }

        const body = config[controllerLevel].mod;
        const cost = CostCalculator.calculateCost(body);

        // 如果能量不足，尝试降级
        if (cost > availableEnergy) {
            const fallbackLevel = Math.max(1, controllerLevel - 1);
            if (fallbackLevel !== controllerLevel && config[fallbackLevel]) {
                return this.buildStandardBody(config, fallbackLevel, availableEnergy);
            }
            // 如果还是不够，返回最小配置
            return this.buildMinimalBody(body);
        }

        return body;
    }
}

module.exports = BodyBuilder;
