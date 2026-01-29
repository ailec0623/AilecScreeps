/**
 * 任务生成器
 * 自动检测能量源和资源，生成任务（减少 Flag 依赖）
 */

const logger = require('../core/Logger');
const MemoryManager = require('../core/MemoryManager');
const TaskReleaser = require('./TaskReleaser');
const Constants = require('../config/Constants');

class TaskGenerator {
    /**
     * 为房间生成所有需要的任务
     * @param {Room} room - 房间对象
     */
    static generateTasks(room) {
        this.generateHarvestTasks(room);
        this.generatePickupTasks(room);
        this.generateUpgradeTask(room);
        // 其他任务由其他模块生成（如 Structures 生成 delivery 任务）
    }

    /**
     * 生成采集任务（自动检测能量源，不依赖 Flag）
     * @param {Room} room - 房间对象
     */
    static generateHarvestTasks(room) {
        const roomMemory = MemoryManager.getRoomMemory(room.name);
        if (!roomMemory) return;

        // 确保有用于持久存储采矿点位的结构（按房间、按source永久缓存）
        if (!roomMemory.harvestPositions) {
            roomMemory.harvestPositions = {};
        }

        const sources = room.find(FIND_SOURCES_ACTIVE);
        
        for (const source of sources) {
            // 检查是否已有任务（包括已分配和未分配的）
            const hasTask = roomMemory.localTasks.harvestpro.some(task => 
                task.releaserId === source.id
            );

            if (hasTask) continue;

            // 查找或加载采矿点位（能量源周围的可通行位置）
            const bestPos = this.findBestHarvestPosition(room, source);
            if (!bestPos) continue;

            // 把采矿点位永久记录到房间内存（不会频繁变化）
            roomMemory.harvestPositions[source.id] = {
                x: bestPos.x,
                y: bestPos.y,
                roomName: bestPos.roomName
            };

            // 检查附近是否有 Link
            const links = bestPos.findInRange(FIND_MY_STRUCTURES, 1, {
                filter: s => s.structureType === STRUCTURE_LINK
            });

            const addition = links.length > 0 ? { link: links[0].id } : null;

            // 发布采集任务
            TaskReleaser.releaseTask(
                room,
                Constants.TASK_TYPES.HARVESTPRO,
                bestPos,
                source.pos,
                source.id,
                1, // 最高优先级
                addition
            );

            logger.debug(`Auto-generated harvest task for source ${source.id} in ${room.name}`);
        }
    }

    /**
     * 查找最佳采集位置
     * 优先选择「同时邻近能量源和link」的位置，其次才按距离控制器最近
     * @param {Room} room - 房间对象
     * @param {Source} source - 能量源
     * @returns {RoomPosition|null}
     */
    static findBestHarvestPosition(room, source) {
        const roomMemory = MemoryManager.getRoomMemory(room.name);
        // 1. 优先使用房间内存中持久记录的采矿点位（如果存在）
        if (roomMemory && roomMemory.harvestPositions && roomMemory.harvestPositions[source.id]) {
            const posData = roomMemory.harvestPositions[source.id];
            const savedPos = new RoomPosition(posData.x, posData.y, posData.roomName || room.name);
            return savedPos;
        }

        // 2. 否则重新计算一次，并写回内存
        const terrain = new Room.Terrain(room.name);
        const allPositions = [];
        const preferredPositions = [];

        // 找出靠近该能量源的link（范围2以内）
        const sourceLinks = room.find(FIND_MY_STRUCTURES, {
            filter: s =>
                s.structureType === STRUCTURE_LINK &&
                s.pos.getRangeTo(source.pos) <= 2
        });

        // 检查能量源周围的一圈（1 格）位置
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;

                const x = source.pos.x + dx;
                const y = source.pos.y + dy;

                if (x < 0 || x > 49 || y < 0 || y > 49) continue;

                // 1. 地形不能是墙
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

                const pos = room.getPositionAt(x, y);
                if (!pos) continue;

                // 2. 该位置上不能有阻挡建筑（允许 ROAD / CONTAINER / LINK）
                const structures = pos.lookFor(LOOK_STRUCTURES);
                const blocking = structures.some(s => 
                    s.structureType !== STRUCTURE_ROAD &&
                    s.structureType !== STRUCTURE_CONTAINER &&
                    s.structureType !== STRUCTURE_LINK
                );
                if (blocking) continue;

                // 3. 必须可以从房间内某个点走到这里（简单使用 PathFinder 做一次 reachability 检查）
                //    这里优先使用任意 spawn / storage / controller 作为起点之一
                let reachable = false;
                const origins = [];
                const spawns = room.find(FIND_MY_SPAWNS);
                if (spawns.length > 0) {
                    origins.push(spawns[0].pos);
                } else if (room.storage) {
                    origins.push(room.storage.pos);
                } else if (room.controller) {
                    origins.push(room.controller.pos);
                }

                for (const origin of origins) {
                    const result = PathFinder.search(origin, { pos, range: 1 }, {
                        maxOps: 2000,
                        plainCost: 2,
                        swampCost: 10
                    });
                    if (!result.incomplete) {
                        reachable = true;
                        break;
                    }
                }
                // 如果房间里没有任何 origin（极早期情况），暂时认为可达
                if (origins.length === 0) {
                    reachable = true;
                }
                if (!reachable) continue;

                // 4. 计算到控制器的距离（控制器可能不存在，用于后续排序）
                const distanceToController = room.controller
                    ? pos.getRangeTo(room.controller)
                    : 0;

                const info = {
                    pos,
                    distance: distanceToController
                };

                allPositions.push(info);

                // 如果附近有link，并且这个位置距离某个link <= 1，则作为优先候选
                if (sourceLinks.length > 0) {
                    for (const link of sourceLinks) {
                        if (pos.getRangeTo(link) <= 1) {
                            preferredPositions.push(info);
                            break;
                        }
                    }
                }
            }
        }

        // 没有任何可用位置，返回null
        if (allPositions.length === 0) return null;

        const list = preferredPositions.length > 0 ? preferredPositions : allPositions;

        // 选择距离控制器最近的位置
        list.sort((a, b) => a.distance - b.distance);
        return list[0].pos;
    }

    /**
     * 生成拾取任务（自动检测掉落资源，不依赖 Flag）
     * @param {Room} room - 房间对象
     */
    static generatePickupTasks(room) {
        const roomMemory = MemoryManager.getRoomMemory(room.name);
        if (!roomMemory) return;

        // 查找掉落资源
        const resources = room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 50
        });

        // 查找容器中的能量
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
                        s.store.getUsedCapacity(RESOURCE_ENERGY) >= 100
        });

        // 处理掉落资源
        for (const resource of resources) {
            const existingTasks = roomMemory.localTasks.pickup.filter(
                task => task.releaserId === resource.id
            ).length;

            if (existingTasks >= 2) continue; // 最多 2 个拾取任务

            const priority = 100 - Math.floor(resource.amount / 50);
            // 将资源数量存储在addition中，避免Carrier需要调用Game.getObjectById
            TaskReleaser.releaseTask(
                room,
                Constants.TASK_TYPES.PICKUP,
                resource.pos,
                resource.pos,
                resource.id,
                priority,
                { amount: resource.amount, isResource: true }
            );
        }

        // 处理容器
        for (const container of containers) {
            const existingTasks = roomMemory.localTasks.pickup.filter(
                task => task.releaserId === container.id
            ).length;

            const energy = container.store.getUsedCapacity(RESOURCE_ENERGY);
            if (existingTasks >= Math.min(2, Math.floor(energy / 300))) continue;

            const priority = 100 - Math.floor(energy / 50);
            // 将容器能量数量存储在addition中
            TaskReleaser.releaseTask(
                room,
                Constants.TASK_TYPES.PICKUP,
                container.pos,
                container.pos,
                container.id,
                priority,
                { amount: energy, isResource: false, isContainer: true }
            );
        }
    }

    /**
     * 生成升级任务（自动检测控制器，不依赖 Flag）
     * @param {Room} room - 房间对象
     */
    static generateUpgradeTask(room) {
        const roomMemory = MemoryManager.getRoomMemory(room.name);
        if (!roomMemory || !room.controller) return;

        // 检查是否已有升级任务
        const hasTask = roomMemory.localTasks.upgrade.some(task => 
            task.releaserId === room.controller.id
        );

        if (hasTask) return;

        // 发布升级任务（始终存在，优先级较低）
        TaskReleaser.releaseTask(
            room,
            Constants.TASK_TYPES.UPGRADE,
            room.controller.pos,
            room.controller.pos,
            room.controller.id,
            100 // 较低优先级，但始终存在
        );

        logger.debug(`Auto-generated upgrade task for controller in ${room.name}`);
    }
}

module.exports = TaskGenerator;
