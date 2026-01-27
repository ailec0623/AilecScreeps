/**
 * 智能修理管理器
 * 实现道路和城墙的智能修理策略
 */

const logger = require('../core/Logger');
const MemoryManager = require('../core/MemoryManager');
const TaskReleaser = require('../task/TaskReleaser');
const Constants = require('../config/Constants');

class RoomRepairer {
    /**
     * 为房间生成修理任务
     * @param {Room} room - 房间对象
     */
    static generateRepairTasks(room) {
        const roomMemory = MemoryManager.getRoomMemory(room.name);
        if (!roomMemory) return;

        // 修理道路
        this.repairRoads(room, roomMemory);

        // 修理城墙
        this.repairWalls(room, roomMemory);
    }

    /**
     * 修理道路（根据使用频率和损坏程度）
     * @param {Room} room - 房间对象
     * @param {Object} roomMemory - 房间内存
     */
    static repairRoads(room, roomMemory) {
        // 查找需要修理的道路
        const roads = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_ROAD &&
                       s.hitsMax - s.hits > 2500 // 损坏超过 2500
        });

        // 计算道路使用频率（简化：根据到重要建筑的距离）
        const importantStructures = [
            ...room.find(FIND_MY_SPAWNS),
            ...room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE }),
            room.controller
        ].filter(s => s);

        // 为每条道路计算优先级
        const roadPriorities = roads.map(road => {
            let priority = 1; // 基础优先级

            // 根据损坏程度调整优先级（损坏越多优先级越高）
            const damage = road.hitsMax - road.hits;
            priority += Math.floor(damage / 1000);

            // 根据到重要建筑的距离调整优先级（越近优先级越高）
            let minDistance = Infinity;
            for (const structure of importantStructures) {
                const distance = road.pos.getRangeTo(structure);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
            priority += Math.max(0, 10 - minDistance); // 距离越近优先级越高

            return {
                road: road,
                priority: priority,
                damage: damage
            };
        });

        // 按优先级排序
        roadPriorities.sort((a, b) => b.priority - a.priority);

        // 为前几条高优先级道路生成任务
        for (const roadInfo of roadPriorities.slice(0, 5)) {
            const road = roadInfo.road;
            
            // 检查是否已有任务
            const hasTask = roomMemory.localTasks.repair.some(task => 
                task.releaserId === road.id
            );

            if (!hasTask) {
                TaskReleaser.releaseTask(
                    room,
                    Constants.TASK_TYPES.REPAIR,
                    road.pos,
                    road.pos,
                    road.id,
                    roadInfo.priority
                );
            }
        }
    }

    /**
     * 修理城墙（根据威胁等级和动态调整）
     * @param {Room} room - 房间对象
     * @param {Object} roomMemory - 房间内存
     */
    static repairWalls(room, roomMemory) {
        // 检查威胁等级
        const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
        const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
        const isUnderAttack = hostileCreeps.length > 0 || hostileStructures.length > 0;

        // 动态调整目标血量
        let targetHits = (roomMemory.repairStrategy && roomMemory.repairStrategy.wallHits) || 100;
        
        if (isUnderAttack) {
            // 被攻击时，提高目标血量
            targetHits = Math.max(targetHits, 10000);
        } else if (room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 400000) {
            // 能量充足时，逐步提高目标血量
            if (Game.time % 20 === 0) {
                targetHits = Math.min(targetHits + 1000, 30000000);
                roomMemory.repairStrategy = roomMemory.repairStrategy || {};
                roomMemory.repairStrategy.wallHits = targetHits;
            }
        }

        // 查找需要修理的城墙和 rampart
        const walls = room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) &&
                       s.hits < targetHits
        });

        if (walls.length === 0) {
            return;
        }

        // 按血量排序（血量越少优先级越高）
        walls.sort((a, b) => a.hits - b.hits);

        // 优先修理血量最低的城墙
        for (const wall of walls.slice(0, 3)) {
            // 检查是否已有任务
            const hasTask = roomMemory.localTasks.repair.some(task => 
                task.releaserId === wall.id
            );

            if (!hasTask) {
                // 计算优先级（血量越低优先级越高）
                const priority = Math.max(1, Math.floor((targetHits - wall.hits) / 10000));
                
                TaskReleaser.releaseTask(
                    room,
                    Constants.TASK_TYPES.REPAIR,
                    wall.pos,
                    wall.pos,
                    wall.id,
                    priority
                );
            }
        }
    }

    /**
     * 更新房间修理策略
     * @param {Room} room - 房间对象
     */
    static updateRepairStrategy(room) {
        const roomMemory = MemoryManager.getRoomMemory(room.name);
        if (!roomMemory) return;

        // 检查是否被攻击
        const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
        if (hostileCreeps.length > 0) {
            roomMemory.status = Constants.ROOM_STATUS.UNDER_ATTACK;
        } else {
            roomMemory.status = Constants.ROOM_STATUS.NORMAL;
        }

        // 根据房间状态调整策略
        if (!roomMemory.repairStrategy) {
            roomMemory.repairStrategy = {
                roadPriority: 1,
                wallHits: 100,
                rampartHits: 100
            };
        }
    }
}

module.exports = RoomRepairer;
