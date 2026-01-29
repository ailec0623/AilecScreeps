/**
 * 任务行为实现
 * 从 task.behavior.js 迁移
 */

function unwrapCreep(creepOrAgent) {
    return creepOrAgent && creepOrAgent.creep ? creepOrAgent.creep : creepOrAgent;
}

const TaskBehaviors = {
    harvestPro: function(creep, task) {
        creep = unwrapCreep(creep);
        // 缓存source对象，避免重复查找
        const source = Game.getObjectById(task.releaserId);
        if (!source) {
            return; // source不存在，无法采集
        }

        const targetPos = new RoomPosition(
            task.sourcePosition.x,
            task.sourcePosition.y,
            task.sourcePosition.roomName
        );

        // 如果harvester有carry部件且满能量，优先检查身边的link并交付
        if (creep.store.getCapacity() > 0 && creep.store.getFreeCapacity() < 20) {
            // 检查身边的link（优先于任务中存储的link）
            const nearbyLinks = creep.pos.findInRange(FIND_MY_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_LINK && 
                            s.store && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            
            if (nearbyLinks.length > 0) {
                // 优先交付给身边的link
                const link = nearbyLinks[0];
                if (creep.transfer(link, RESOURCE_ENERGY) === OK) {
                    // 交付成功，继续采集
                    creep.harvest(source);
                    return;
                }
            } else if (task.addition && task.addition.link) {
                // 如果没有身边的link，尝试任务中存储的link（可能在相邻位置）
                const link = Game.getObjectById(task.addition.link);
                if (link && link.store && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    if (creep.transfer(link, RESOURCE_ENERGY) === OK) {
                        creep.harvest(source);
                        return;
                    }
                }
            }
        }

        // 移动到目标位置或采集
        if (creep.room.name !== targetPos.roomName || 
            creep.pos.x !== targetPos.x || 
            creep.pos.y !== targetPos.y) {
            creep.moveTo(targetPos, {reusePath: 50});
        } else {
            creep.harvest(source);
        }
    },

    pickUp: function(creep, task) {
        creep = unwrapCreep(creep);
        const target = Game.getObjectById(task.releaserId);
        if (!target) {
            // 目标不存在，完成任务
            if (creep.memory.inTask && creep.memory.task) {
                const RoleClasses = {
                    harvesterpro: require('../../creep/roles/HarvesterPro'),
                    carrier: require('../../creep/roles/Carrier'),
                    worker: require('../../creep/roles/Worker')
                };
                const roleName = creep.memory.role;
                if (roleName && RoleClasses[roleName]) {
                    const roleInstance = new RoleClasses[roleName](creep);
                    roleInstance.completeTask(task);
                }
            }
            return;
        }

        // 根据目标类型选择操作：Structure用withdraw，Resource用pickup
        if (target.store !== undefined) {
            // 是Structure（container, storage, link等）
            const result = creep.withdraw(target, RESOURCE_ENERGY);
            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {reusePath: 10});
            } else if (result !== OK) {
                // 拾取失败（如资源不足、目标无效等），放弃任务
                if (creep.memory.inTask && creep.memory.task) {
                    const RoleClasses = {
                        harvesterpro: require('../../creep/roles/HarvesterPro'),
                        carrier: require('../../creep/roles/Carrier'),
                        worker: require('../../creep/roles/Worker')
                    };
                    const roleName = creep.memory.role;
                    if (roleName && RoleClasses[roleName]) {
                        const roleInstance = new RoleClasses[roleName](creep);
                        roleInstance.completeTask(task);
                    }
                }
            }
        } else if (target.amount !== undefined) {
            // 是Resource
            const result = creep.pickup(target);
            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {reusePath: 10});
            } else if (result !== OK) {
                // 拾取失败（如资源已被拾取、目标无效等），放弃任务
                if (creep.memory.inTask && creep.memory.task) {
                    const RoleClasses = {
                        harvesterpro: require('../../creep/roles/HarvesterPro'),
                        carrier: require('../../creep/roles/Carrier'),
                        worker: require('../../creep/roles/Worker')
                    };
                    const roleName = creep.memory.role;
                    if (roleName && RoleClasses[roleName]) {
                        const roleInstance = new RoleClasses[roleName](creep);
                        roleInstance.completeTask(task);
                    }
                }
            }
        } else {
            // 未知类型，尝试移动到目标位置
            const targetPos = new RoomPosition(
                task.sourcePosition.x,
                task.sourcePosition.y,
                task.sourcePosition.roomName
            );
            creep.moveTo(targetPos);
        }
    },

    delivery: function(creep, task) {
        creep = unwrapCreep(creep);
        const target = Game.getObjectById(task.releaserId);
        if (!target) {
            return; // 目标不存在
        }
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 10});
        }
    },

    getenergy: function(creep, task) {
        creep = unwrapCreep(creep);
        const target = Game.getObjectById(task.releaserId);
        if (!target || !target.store) {
            return; // 目标不存在或没有store
        }
        if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 10});
        }
    },

    repair: function(creep, task) {
        creep = unwrapCreep(creep);
        const target = Game.getObjectById(task.releaserId);
        if (!target) {
            return; // 目标不存在
        }
        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 10});
        }
    },

    build: function(creep, task) {
        creep = unwrapCreep(creep);
        const target = Game.getObjectById(task.releaserId);
        if (!target) {
            // 目标不存在，移动到目标位置
            const targetPos = new RoomPosition(
                task.targetPosition.x,
                task.targetPosition.y,
                task.targetPosition.roomName
            );
            creep.moveTo(targetPos);
            return;
        }
        if (creep.build(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 10});
        }
    },

    upgrade: function(creep, task) {
        creep = unwrapCreep(creep);
        const target = Game.getObjectById(task.releaserId);
        if (!target) {
            return; // 目标不存在
        }
        if (creep.upgradeController(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 10});
        }
    },

    reserve: function(creep, task) {
        creep = unwrapCreep(creep);
        const target = Game.getObjectById(task.releaserId);
        if (creep.reserveController(target) === ERR_NOT_IN_RANGE) {
            if (creep.moveTo(target, {reusePath: 50}) !== OK) {
                const targetPos = new RoomPosition(
                    task.sourcePosition.x,
                    task.sourcePosition.y,
                    task.sourcePosition.roomName
                );
                creep.moveTo(targetPos, {reusePath: 50});
            }
        }
    },

    guard: function(creep, task) {
        creep = unwrapCreep(creep);
        const target = Game.getObjectById(task.releaserId);
        const state = creep.attack(target);
        if (state === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        } else if (state === ERR_INVALID_TARGET) {
            const targetPos = new RoomPosition(
                task.sourcePosition.x,
                task.sourcePosition.y,
                task.sourcePosition.roomName
            );
            creep.moveTo(targetPos, {reusePath: 50});
        }
    },

    destroy: function(creep) {
        creep = unwrapCreep(creep);
        const mainRoom = creep.memory.room;
        const roomMemory = require('../../core/MemoryManager').getRoomMemory(mainRoom);
        
        if (!roomMemory || roomMemory.destroy.length === 0) {
            return;
        }

        const targetRoom = roomMemory.destroy[0];
        if (creep.room.name !== targetRoom) {
            creep.moveTo(new RoomPosition(25, 25, targetRoom));
        } else {
            // 优化：使用GameCache缓存的hostile creeps和structures，避免每个creep都查找
            const GameCache = require('../../core/GameCache');
            let targets = GameCache.getHostileCreeps(creep.room.name);
            if (targets.length !== 0) {
                if (creep.attack(targets[0]) !== OK) {
                    creep.moveTo(targets[0]);
                }
                return;
            }

            targets = GameCache.getHostileStructures(creep.room.name);
            if (targets.length > 0) {
                if (creep.attack(targets[0]) !== OK) {
                    creep.moveTo(targets[0]);
                }
            }
        }
    }
};

module.exports = TaskBehaviors;
