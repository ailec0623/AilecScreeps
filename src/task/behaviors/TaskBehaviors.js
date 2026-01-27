/**
 * 任务行为实现
 * 从 task.behavior.js 迁移
 */

const TaskBehaviors = {
    harvestPro: function(creep, task) {
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
        const target = Game.getObjectById(task.releaserId);
        if (!target) {
            // 目标不存在，移动到目标位置
            const targetPos = new RoomPosition(
                task.sourcePosition.x,
                task.sourcePosition.y,
                task.sourcePosition.roomName
            );
            creep.moveTo(targetPos);
            return;
        }

        // 根据目标类型选择操作：Structure用withdraw，Resource用pickup
        if (target.store !== undefined) {
            // 是Structure（container, storage, link等）
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {reusePath: 10});
            }
        } else if (target.amount !== undefined) {
            // 是Resource
            if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {reusePath: 10});
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
        const target = Game.getObjectById(task.releaserId);
        if (!target) {
            return; // 目标不存在
        }
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 10});
        }
    },

    getenergy: function(creep, task) {
        const target = Game.getObjectById(task.releaserId);
        if (!target || !target.store) {
            return; // 目标不存在或没有store
        }
        if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 10});
        }
    },

    repair: function(creep, task) {
        const target = Game.getObjectById(task.releaserId);
        if (!target) {
            return; // 目标不存在
        }
        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 10});
        }
    },

    build: function(creep, task) {
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
        const target = Game.getObjectById(task.releaserId);
        if (!target) {
            return; // 目标不存在
        }
        if (creep.upgradeController(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {reusePath: 10});
        }
    },

    reserve: function(creep, task) {
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
        const mainRoom = creep.memory.room;
        const roomMemory = require('../../core/MemoryManager').getRoomMemory(mainRoom);
        
        if (!roomMemory || roomMemory.destroy.length === 0) {
            return;
        }

        const targetRoom = roomMemory.destroy[0];
        if (creep.room.name !== targetRoom) {
            creep.moveTo(new RoomPosition(25, 25, targetRoom));
        } else {
            let targets = creep.room.find(FIND_HOSTILE_CREEPS);
            if (targets.length !== 0) {
                if (creep.attack(targets[0]) !== OK) {
                    creep.moveTo(targets[0]);
                }
                return;
            }

            targets = creep.room.find(FIND_HOSTILE_STRUCTURES, {
                filter: function(object) {
                    return object.structureType !== STRUCTURE_CONTROLLER && 
                           object.structureType !== STRUCTURE_WALL && 
                           object.structureType !== STRUCTURE_RAMPART;
                }
            });

            if (targets.length > 0) {
                if (creep.attack(targets[0]) !== OK) {
                    creep.moveTo(targets[0]);
                }
            }
        }
    }
};

module.exports = TaskBehaviors;
