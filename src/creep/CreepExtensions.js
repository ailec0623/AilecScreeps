/**
 * Creep 原型扩展
 * 支持跨房间任务和角色系统
 */

const logger = require('../core/Logger');
const ErrorHandler = require('../core/ErrorHandler');
const MemoryManager = require('../core/MemoryManager');

// 角色类映射
const RoleClasses = {
    harvesterpro: require('./roles/HarvesterPro'),
    carrier: require('./roles/Carrier'),
    worker: require('./roles/Worker'),
    // 其他角色可以后续添加
};

/**
 * 获取角色实例
 */
function getRoleInstance(creep) {
    const roleName = creep.memory.role;
    if (!roleName || !RoleClasses[roleName]) {
        return null;
    }
    return new RoleClasses[roleName](creep);
}

const creepExtension = {
    /**
     * 接受任务
     */
    acceptTask: function() {
        // 如果正在生成，跳过（生成完成后才能接受任务）
        if (this.spawning) {
            return;
        }

        // 如果已经在任务中，跳过
        if (this.memory.inTask) {
            return;
        }

        const roleInstance = getRoleInstance(this);
        if (roleInstance) {
            ErrorHandler.safeExecute(() => {
                const result = roleInstance.acceptTask();
                if (result && !this.memory.inTask) {
                    // 如果 acceptTask 返回 true 但 inTask 还是 false，说明有问题
                    logger.warn(`Creep ${this.name} acceptTask returned true but inTask is still false`);
                }
            }, `Creep.acceptTask(${this.name})`);
        }
    },

    /**
     * 执行任务
     */
    operate: function() {
        if (this.spawning) {
            return;
        }

        // 处理特殊角色
        if (this.memory.role === 'claimer') {
            this.operateClaimer();
            return;
        }

        if (this.memory.role === 'conqueror') {
            const TaskBehaviors = require('../task/behaviors/TaskBehaviors');
            TaskBehaviors.destroy(this);
            return;
        }

        if (this.memory.role === 'reserver') {
            this.operateReserver();
            return;
        }

        if (this.memory.role === 'guard') {
            this.operateGuard();
            return;
        }

        // 使用角色系统
        const roleInstance = getRoleInstance(this);
        if (roleInstance) {
            ErrorHandler.safeExecute(() => {
                roleInstance.operate();
            }, `Creep.operate(${this.name})`);
        }
    },

    /**
     * 审查任务
     */
    reviewTask: function() {
        if (!this.memory.inTask) {
            return;
        }

        const roleInstance = getRoleInstance(this);
        if (roleInstance) {
            ErrorHandler.safeExecute(() => {
                roleInstance.reviewTask();
            }, `Creep.reviewTask(${this.name})`);
        }
    },

    /**
     * 占领者操作
     */
    operateClaimer: function() {
        const roomMemory = MemoryManager.getRoomMemory(this.memory.room);
        if (!roomMemory || !roomMemory.claimRoom) {
            return;
        }

        const targetRoomName = roomMemory.claimRoom;
        const room = Game.rooms[targetRoomName];

        try {
            if (!room || !room.controller) {
                this.moveTo(new RoomPosition(25, 25, targetRoomName));
                return;
            }

            const result = this.claimController(room.controller);
            if (result === ERR_NOT_IN_RANGE) {
                this.moveTo(room.controller);
            } else if (result === ERR_INVALID_TARGET) {
                this.attackController(room.controller);
            }
        } catch (e) {
            this.moveTo(new RoomPosition(25, 25, targetRoomName));
        }
    },

    /**
     * 预订者操作
     */
    operateReserver: function() {
        const colony = MemoryManager.getColonyMemory();
        const mainRoom = this.memory.room;
        const roomMemory = MemoryManager.getRoomMemory(mainRoom);

        if (!roomMemory || !roomMemory.extension || roomMemory.extension.length === 0) {
            return;
        }

        // 查找需要预订的扩展房间
        for (const extRoomName of roomMemory.extension) {
            const extRoom = Game.rooms[extRoomName];
            if (!extRoom || !extRoom.controller) {
                continue;
            }

            // 如果不在目标房间，移动到目标房间
            if (this.room.name !== extRoomName) {
                this.moveTo(new RoomPosition(25, 25, extRoomName));
                return;
            }

            // 预订控制器
            const result = this.reserveController(extRoom.controller);
            if (result === ERR_NOT_IN_RANGE) {
                this.moveTo(extRoom.controller, {reusePath: 50});
            }
            return;
        }
    },

    /**
     * 守卫操作
     */
    operateGuard: function() {
        const task = this.memory.task;
        if (task) {
            const TaskBehaviors = require('../task/behaviors/TaskBehaviors');
            TaskBehaviors.guard(this, task);
        } else {
            // 如果没有任务，查找附近的敌人
            const targets = this.room.find(FIND_HOSTILE_CREEPS);
            if (targets.length > 0) {
                if (this.attack(targets[0]) === ERR_NOT_IN_RANGE) {
                    this.moveTo(targets[0]);
                }
            } else {
                const structures = this.room.find(FIND_HOSTILE_STRUCTURES);
                if (structures.length > 0) {
                    if (this.attack(structures[0]) === ERR_NOT_IN_RANGE) {
                        this.moveTo(structures[0]);
                    }
                }
            }
        }
    }
};

module.exports = function() {
    _.assign(Creep.prototype, creepExtension);
};
