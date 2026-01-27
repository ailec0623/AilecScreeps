/**
 * 任务发布器兼容层
 * 为旧系统提供兼容接口，内部使用新的内存路径
 */

var Releaser = {
    releaseTask: function(room, taskType, sourcePosition, targetPosition, releaserId, priority, addition) {
        const roomName = typeof room === 'string' ? room : room.name;
        
        // 确保新内存系统已初始化
        if (!Memory.colony_v2 || !Memory.colony_v2.colony || !Memory.colony_v2.colony.rooms[roomName]) {
            // 如果新系统未初始化，回退到旧内存路径
            if (!Memory.rooms) {
                Memory.rooms = {};
            }
            if (!Memory.rooms[roomName]) {
                Memory.rooms[roomName] = {};
            }
            if (!Memory.rooms[roomName].tasks) {
                Memory.rooms[roomName].tasks = {};
            }
            if (!Memory.rooms[roomName].tasks[taskType]) {
                Memory.rooms[roomName].tasks[taskType] = [];
            }
            
            const task = {
                type: taskType,
                creepId: null,
                sourcePosition: sourcePosition,
                targetPosition: targetPosition,
                priority: priority,
                releaserId: releaserId,
                addition: addition
            };
            Memory.rooms[roomName].tasks[taskType].push(task);
            return;
        }
        
        // 使用新内存系统
        const roomMemory = Memory.colony_v2.colony.rooms[roomName];
        if (!roomMemory.localTasks) {
            roomMemory.localTasks = {
                harvestpro: [],
                pickup: [],
                delivery: [],
                getenergy: [],
                repair: [],
                build: [],
                upgrade: [],
                reserve: [],
                guard: [],
                spawn: []
            };
        }
        
        if (!roomMemory.localTasks[taskType]) {
            roomMemory.localTasks[taskType] = [];
        }
        
        // 标准化位置对象
        const normalizePosition = (pos) => {
            if (!pos) {
                return { x: 0, y: 0, roomName: roomName };
            }
            if (pos.x !== undefined && pos.y !== undefined) {
                return {
                    x: pos.x,
                    y: pos.y,
                    roomName: pos.roomName || roomName
                };
            }
            return { x: 0, y: 0, roomName: roomName };
        };
        
        const task = {
            type: taskType,
            creepId: null,
            sourcePosition: normalizePosition(sourcePosition),
            targetPosition: normalizePosition(targetPosition),
            priority: priority,
            releaserId: releaserId,
            addition: addition,
            crossRoom: false,
            createdAt: Game.time
        };
        
        roomMemory.localTasks[taskType].push(task);
    }
};

module.exports = Releaser;
