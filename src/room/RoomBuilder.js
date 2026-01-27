/**
 * 房间建筑管理器
 * 处理房间的自动建造
 */

const logger = require('../core/Logger');
const MemoryManager = require('../core/MemoryManager');
const buildingCount = require('../structure.count');

class RoomBuilder {
    /**
     * 处理房间建造
     * @param {Room} room - 房间对象
     */
    static build(room) {
        const roomMemory = MemoryManager.getRoomMemory(room.name);
        if (!roomMemory || !room.controller) {
            return;
        }

        // 如果控制器即将降级，暂停建造
        if (room.controller.ticksToDowngrade <= 4000) {
            return;
        }

        // 检查是否启用自动建造
        if (!roomMemory.autoBuild) {
            return;
        }

        // 如果没有建筑工地，尝试创建新的
        if (room.find(FIND_CONSTRUCTION_SITES).length === 0) {
            this.createBuildings(room, roomMemory);
        }
    }

    /**
     * 创建建筑
     * @param {Room} room - 房间对象
     * @param {Object} roomMemory - 房间内存
     */
    static createBuildings(room, roomMemory) {
        const controllerLevel = room.controller.level;
        const buildings = roomMemory.buildings || {};

        // 建筑类型到颜色的映射
        const colorMap = {
            STRUCTURE_TOWER: COLOR_YELLOW,
            STRUCTURE_ROAD: COLOR_RED,
            STRUCTURE_EXTENSION: COLOR_PURPLE,
            STRUCTURE_LINK: COLOR_BROWN,
            STRUCTURE_FACTORY: COLOR_GREY,
            STRUCTURE_LAB: COLOR_BLUE,
            STRUCTURE_NUKER: COLOR_YELLOW,
            STRUCTURE_OBSERVER: COLOR_GREEN,
            STRUCTURE_POWER_SPAWN: COLOR_CYAN,
            STRUCTURE_SPAWN: COLOR_CYAN,
            STRUCTURE_STORAGE: COLOR_WHITE,
            STRUCTURE_TERMINAL: COLOR_ORANGE
        };

        // 建筑类型映射
        const structureTypeMap = {
            STRUCTURE_TOWER: STRUCTURE_TOWER,
            STRUCTURE_ROAD: STRUCTURE_ROAD,
            STRUCTURE_EXTENSION: STRUCTURE_EXTENSION,
            STRUCTURE_LINK: STRUCTURE_LINK,
            STRUCTURE_FACTORY: STRUCTURE_FACTORY,
            STRUCTURE_LAB: STRUCTURE_LAB,
            STRUCTURE_NUKER: STRUCTURE_NUKER,
            STRUCTURE_OBSERVER: STRUCTURE_OBSERVER,
            STRUCTURE_POWER_SPAWN: STRUCTURE_POWER_SPAWN,
            STRUCTURE_SPAWN: STRUCTURE_SPAWN,
            STRUCTURE_STORAGE: STRUCTURE_STORAGE,
            STRUCTURE_TERMINAL: STRUCTURE_TERMINAL
        };

        // 检查每种建筑
        for (const buildingType in buildingCount) {
            const currentCount = buildings[buildingType] || 0;
            const targetCount = buildingCount[buildingType][controllerLevel - 1] || 0;

            if (currentCount < targetCount) {
                // 需要建造
                const firstSpawn = roomMemory.firstSpawn;
                if (!firstSpawn) {
                    continue;
                }

                const central = room.getPositionAt(firstSpawn.pos.x, firstSpawn.pos.y);
                const color = colorMap[buildingType];
                const structureType = structureTypeMap[buildingType];

                // 查找对应的旗帜
                const flag = central.findClosestByRange(FIND_FLAGS, {
                    filter: f => f.color === COLOR_BLUE && f.secondaryColor === color
                });

                if (flag) {
                    // 创建建筑工地
                    const result = flag.pos.createConstructionSite(structureType);
                    if (result === OK) {
                        flag.remove();
                        buildings[buildingType] = (buildings[buildingType] || 0) + 1;
                        logger.debug(`Creating ${buildingType} at ${flag.pos}`);
                    }
                    break; // 一次只创建一个
                } else {
                    logger.warn(`No flag found for ${buildingType}`);
                }
            }
        }

        // 更新内存
        roomMemory.buildings = buildings;

        // 如果所有建筑都建好了且等级为 8，关闭自动建造
        if (controllerLevel === 8) {
            const flags = room.find(FIND_FLAGS, {
                filter: f => f.color === COLOR_BLUE
            });
            if (flags.length === 0) {
                roomMemory.autoBuild = false;
            }
        }
    }
}

module.exports = RoomBuilder;
