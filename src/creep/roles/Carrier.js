/**
 * 运输者角色
 * 仅处理本房间的运输任务
 */

const BaseRole = require('./BaseRole');
const TaskBehaviors = require('../../task/behaviors/TaskBehaviors');

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
            let task = this.findAvailableTask('pickup', this.creep.memory.room, (t) => {
                // 检查资源数量是否足够
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
                // 如果没有足够的拾取任务，查找获取能量任务（从storage获取）
                task = this.findAvailableTask('getenergy', this.creep.memory.room);
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

        switch (task.type) {
            case 'pickup':
                TaskBehaviors.pickUp(this.creep, task);
                break;
            case 'getenergy':
                TaskBehaviors.getenergy(this.creep, task);
                break;
            case 'delivery':
                TaskBehaviors.delivery(this.creep, task);
                break;
        }
    }

    reviewTask() {
        if (!this.creep.memory.inTask || !this.creep.memory.task) {
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
                        this.completeTask(task);
                    } else if (target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) < 2) {
                        this.completeTask(task);
                    }
                }
                break;
        }
    }
}

module.exports = Carrier;
