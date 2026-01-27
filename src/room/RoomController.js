/**
 * 房间控制器
 * 作为殖民地的子单元，管理房间的日常运转
 */

const logger = require('../core/Logger');
const ErrorHandler = require('../core/ErrorHandler');
const MemoryManager = require('../core/MemoryManager');
const RoomBuilder = require('./RoomBuilder');
const RoomRepairer = require('./RoomRepairer');
const Task = require('../task'); // 旧任务系统（逐步迁移）

class RoomController {
    /**
     * 运行主房间
     * @param {Room} room - 房间对象
     */
    static runMainRoom(room) {
        ErrorHandler.safeExecute(() => {
            const roomMemory = MemoryManager.getRoomMemory(room.name);
            if (!roomMemory) {
                return;
            }

            // 初始化任务（使用旧系统，逐步迁移）
            Task.initTasks(room.name);

            // 自动建造
            if (roomMemory.autoBuild) {
                RoomBuilder.build(room);
            }

            // 生成生成任务（使用旧系统，逐步迁移）
            Task.spawnTasks(room);

            // 处理扩展房间
            if (roomMemory.extension && roomMemory.extension.length > 0) {
                for (const extRoomName of roomMemory.extension) {
                    this.runExtensionRoom(extRoomName);
                }
            }

            // 处理占领房间
            if (roomMemory.claimRoom) {
                this.handleClaimRoom(room, roomMemory.claimRoom);
            }

            // 处理摧毁房间
            if (roomMemory.destroy && roomMemory.destroy.length > 0) {
                this.handleDestroyRoom(room, roomMemory.destroy[0]);
            }

        }, `RoomController.runMainRoom(${room.name})`);
    }

    /**
     * 运行扩展房间
     * @param {string} roomName - 房间名称
     */
    static runExtensionRoom(roomName) {
        const room = Game.rooms[roomName];
        if (!room) {
            return;
        }

        ErrorHandler.safeExecute(() => {
            // 初始化任务
            Task.initTasks(roomName);

            // 预订任务
            Task.reserveTask(room);

            // 守卫任务
            Task.guardTask(room);

            // 修理任务（使用智能修理系统）
            const roomMemory = MemoryManager.getRoomMemory(roomName);
            if (roomMemory) {
                RoomRepairer.updateRepairStrategy(room);
                RoomRepairer.generateRepairTasks(room);
            }

        }, `RoomController.runExtensionRoom(${roomName})`);
    }

    /**
     * 处理占领房间
     * @param {Room} mainRoom - 主房间
     * @param {string} targetRoomName - 目标房间名称
     */
    static handleClaimRoom(mainRoom, targetRoomName) {
        const observer = mainRoom.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_OBSERVER }
        })[0];

        if (!observer) {
            return;
        }

        observer.observeRoom(targetRoomName);

        try {
            const targetRoom = Game.rooms[targetRoomName];
            if (targetRoom && targetRoom.controller && targetRoom.controller.my) {
                const roomMemory = MemoryManager.getRoomMemory(mainRoom.name);
                if (roomMemory) {
                    roomMemory.claimRoom = '';
                }
            }
        } catch (e) {
            // 房间不可见
        }
    }

    /**
     * 处理摧毁房间
     * @param {Room} mainRoom - 主房间
     * @param {string} targetRoomName - 目标房间名称
     */
    static handleDestroyRoom(mainRoom, targetRoomName) {
        const observer = mainRoom.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_OBSERVER }
        })[0];

        if (!observer) {
            return;
        }

        observer.observeRoom(targetRoomName);

        try {
            const targetRoom = Game.rooms[targetRoomName];
            if (!targetRoom) {
                return;
            }

            const targets = targetRoom.find(FIND_HOSTILE_STRUCTURES, {
                filter: s => s.structureType !== STRUCTURE_CONTROLLER
            });

            if (targets.length === 0) {
                const roomMemory = MemoryManager.getRoomMemory(mainRoom.name);
                if (roomMemory) {
                    roomMemory.destroy = [];
                }
            }
        } catch (e) {
            // 房间不可见
        }
    }
}

module.exports = RoomController;
