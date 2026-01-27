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

        const sources = room.find(FIND_SOURCES_ACTIVE);
        
        for (const source of sources) {
            // 检查是否已有任务
            const hasTask = roomMemory.localTasks.harvestpro.some(task => 
                task.releaserId === source.id
            );

            if (hasTask) continue;

            // 查找最佳采集位置（能量源周围的可通行位置）
            const bestPos = this.findBestHarvestPosition(room, source);
            if (!bestPos) continue;

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
     * @param {Room} room - 房间对象
     * @param {Source} source - 能量源
     * @returns {RoomPosition|null}
     */
    static findBestHarvestPosition(room, source) {
        const terrain = new Room.Terrain(room.name);
        const positions = [];

        // 检查能量源周围的位置
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;

                const x = source.pos.x + dx;
                const y = source.pos.y + dy;

                if (x < 0 || x > 49 || y < 0 || y > 49) continue;

                // 检查地形
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

                // 检查是否有建筑阻挡
                const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
                const blocking = structures.some(s => 
                    s.structureType !== STRUCTURE_ROAD &&
                    s.structureType !== STRUCTURE_CONTAINER &&
                    s.structureType !== STRUCTURE_LINK
                );

                if (blocking) continue;

                // 计算到控制器的距离（优先选择近的）
                const pos = room.getPositionAt(x, y);
                const distanceToController = pos.getRangeTo(room.controller);

                positions.push({
                    pos: pos,
                    distance: distanceToController
                });
            }
        }

        if (positions.length === 0) return null;

        // 选择距离控制器最近的位置
        positions.sort((a, b) => a.distance - b.distance);
        return positions[0].pos;
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
            TaskReleaser.releaseTask(
                room,
                Constants.TASK_TYPES.PICKUP,
                resource.pos,
                resource.pos,
                resource.id,
                priority
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
            TaskReleaser.releaseTask(
                room,
                Constants.TASK_TYPES.PICKUP,
                container.pos,
                container.pos,
                container.id,
                priority
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
