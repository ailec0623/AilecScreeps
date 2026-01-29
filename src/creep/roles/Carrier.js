/**
 * 运输者角色
 * 仅处理本房间的运输任务
 */

const BaseRole = require('./BaseRole');

class Carrier extends BaseRole {
    acceptTask() {
        // 检查基础条件
        if (this.creep.memory.inTask || this.creep.spawning) {
            return false;
        }

        const energyUsed = this.creep.store.getUsedCapacity(RESOURCE_ENERGY);

        // 如果能量为空，查找拾取或获取能量任务（仅限本房间）
        if (energyUsed === 0) {
            const creepCapacity = this.creep.store.getCapacity();
            const minPickupAmount = creepCapacity * 0.5; // 最小拾取量：承载力的50%
            
            // 查找拾取任务，但只接受资源数量足够的任务
            // 优化：使用task.addition.amount而不是Game.getObjectById
            let task = this.findAvailableTask('pickup', this.creep.memory.room, (t) => {
                // 优先使用task.addition中存储的数量信息（避免Game.getObjectById调用）
                if (t.addition && t.addition.amount !== undefined) {
                    return t.addition.amount >= minPickupAmount;
                }
                
                // 如果没有存储数量信息，才调用Game.getObjectById（向后兼容）
                const target = Game.getObjectById(t.releaserId);
                if (!target) {
                    return false; // 目标不存在，跳过
                }
                
                // 如果是掉落资源（Resource），检查数量
                if (target.amount !== undefined) {
                    return target.amount >= minPickupAmount;
                }
                
                // 如果是容器（Container），检查能量数量
                if (target.store && target.structureType === STRUCTURE_CONTAINER) {
                    return target.store.getUsedCapacity(RESOURCE_ENERGY) >= minPickupAmount;
                }
                
                // 其他情况（如link等），允许拾取
                return true;
            });

            if (!task) {
                // 如果没有足够的拾取任务，检查是否有需求
                // 1. 检查是否有非storage结构的delivery任务
                // 2. 或者检查是否有upgrade任务（worker需要能量）
                const deliveryTask = this.findAvailableTask('delivery', this.creep.memory.room, (t) => {
                    const target = Game.getObjectById(t.releaserId);
                    // 只接受非storage结构的delivery任务
                    return target && target.structureType !== STRUCTURE_STORAGE && target.structureType !== STRUCTURE_CONTAINER;
                });
                const upgradeTask = this.findAvailableTask('upgrade', this.creep.memory.room);
                
                // 如果有非storage的delivery任务，或者有upgrade任务，可以从storage获取能量
                if (deliveryTask || upgradeTask) {
                    task = this.findAvailableTask('getenergy', this.creep.memory.room);
                }
                // 如果没有这些任务，不获取storage能量，等待pickup任务或其他任务
            }

            if (task) {
                return this.assignTask(task, this.creep.memory.room);
            }
        } else {
            // 如果能量不为空，查找运输任务（仅限本房间）
            const task = this.findAvailableTask('delivery', this.creep.memory.room);
            if (task) {
                return this.assignTask(task, this.creep.memory.room);
            }
        }

        return false;
    }

    /** 执行由 Agent 驱动的类 Task 系统接管，角色层不再调用 TaskBehaviors */
    operate() {
        return;
    }

    /** 仅保留无任务时的“超额清退”逻辑，由 Agent 在无任务时调用 */
    reviewTask() {
        if (this.creep.memory.inTask && this.creep.memory.task) {
            return;
        }
        this.checkIfExceedsRequirement();
    }

    /**
     * 检查是否超过房间需求，如果超过则清除自己
     * 优化：使用GameCache缓存的carrier数量统计，避免重复计算
     */
    checkIfExceedsRequirement() {
        // 避免频繁检查，每10个tick检查一次（与GameCache刷新频率一致）
        if (Game.time % 10 !== 0) {
            return;
        }

        // 优化：使用GameCache缓存的carrier数量统计
        const GameCache = require('../../core/GameCache');
        const countStats = GameCache.getCarrierCount(this.creep.memory.room);
        
        if (!countStats) {
            return;
        }

        // 如果当前数量超过需求，且这个carrier没有任务，则清除自己
        // 优先清除没有任务的carrier
        if (countStats.current > countStats.required && !this.creep.memory.inTask) {
            // 确保能量为空，避免浪费
            if (this.creep.store.getUsedCapacity() === 0) {
                this.creep.suicide();
            }
        }
    }
}

module.exports = Carrier;
