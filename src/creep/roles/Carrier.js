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

    operate() {
        if (this.creep.spawning || !this.creep.memory.inTask) {
            return;
        }

        const task = this.creep.memory.task;
        if (!task) {
            return;
        }

        // 运行时动态获取 TaskBehaviors，确保模块已初始化
        const TaskBehaviors = require('../../task/behaviors/TaskBehaviors');
        if (!TaskBehaviors) {
            const logger = require('../../core/Logger');
            logger.error(`TaskBehaviors not initialized for ${this.creep.name}`);
            return;
        }

        switch (task.type) {
            case 'pickup':
                if (TaskBehaviors.pickUp) {
                    TaskBehaviors.pickUp(this.creep, task);
                }
                break;
            case 'getenergy':
                if (TaskBehaviors.getenergy) {
                    TaskBehaviors.getenergy(this.creep, task);
                }
                break;
            case 'delivery':
                if (TaskBehaviors.delivery) {
                    TaskBehaviors.delivery(this.creep, task);
                }
                break;
        }
    }

    reviewTask() {
        // 检查是否超过房间需求（只在没有任务时检查，避免频繁计算）
        if (!this.creep.memory.inTask || !this.creep.memory.task) {
            this.checkIfExceedsRequirement();
            return;
        }

        const task = this.creep.memory.task;

        switch (task.type) {
            case 'pickup':
                // 如果已经获取资源，完成任务
                if (this.creep.store.getUsedCapacity() > 0) {
                    this.completeTask(task);
                } else {
                    // 检查源是否为空（减少调用频率）
                    const source = Game.getObjectById(task.releaserId);
                    if (!source) {
                        this.completeTask(task);
                    } else if (source.store && source.store.getUsedCapacity(RESOURCE_ENERGY) < 10) {
                        this.completeTask(task);
                    }
                }
                break;

            case 'getenergy':
                // 如果已经获取能量，完成任务
                if (this.creep.store.getUsedCapacity() > 0) {
                    this.completeTask(task);
                } else {
                    const source = Game.getObjectById(task.releaserId);
                    if (!source || !source.store || source.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
                        this.completeTask(task);
                    }
                }
                break;

            case 'delivery':
                // 如果能量为空，完成任务
                if (this.creep.store.getUsedCapacity() === 0) {
                    this.completeTask(task);
                } else {
                    const target = Game.getObjectById(task.releaserId);
                    if (!target) {
                        // 目标不存在，完成任务
                        this.completeTask(task);
                    } else if (target.store) {
                        // 检查目标是否已满（根据结构类型使用不同的阈值）
                        const freeCapacity = target.store.getFreeCapacity(RESOURCE_ENERGY);
                        if (freeCapacity === 0) {
                            // 完全满了，完成任务
                            this.completeTask(task);
                        } else if (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION) {
                            // Spawn 和 Extension：如果剩余空间小于 50，完成任务（避免浪费）
                            if (freeCapacity < 50) {
                                this.completeTask(task);
                            }
                        } else if (target.structureType === STRUCTURE_TOWER) {
                            // Tower：如果剩余空间小于 200，完成任务
                            if (freeCapacity < 200) {
                                this.completeTask(task);
                            }
                        } else {
                            // 其他结构：如果剩余空间小于 2，完成任务
                            if (freeCapacity < 2) {
                                this.completeTask(task);
                            }
                        }
                    } else {
                        // 目标没有 store（不应该发生），完成任务
                        this.completeTask(task);
                    }
                }
                break;
        }
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
