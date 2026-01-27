/**
 * 常量定义
 */

module.exports = {
    // 内存路径
    MEMORY_PATH: 'colony_v2',
    VERSION: '2.0',

    // 生成优先级
    SPAWN_PRIORITY: {
        P0: 0, // 最高优先级 - 能量采集
        P1: 1, // 高优先级 - 能量运输
        P2: 2, // 中优先级 - 基础维护
        P3: 3  // 低优先级 - 扩展功能
    },

    // 角色优先级映射
    ROLE_PRIORITY: {
        harvesterpro: 0, // P0
        carrier: 1,      // P1
        worker: 2,        // P2
        reserver: 3,      // P3
        guard: 3,         // P3
        conqueror: 3,     // P3
        claimer: 3        // P3
    },

    // 任务类型
    TASK_TYPES: {
        HARVESTPRO: 'harvestpro',
        PICKUP: 'pickup',
        DELIVERY: 'delivery',
        GETENERGY: 'getenergy',
        REPAIR: 'repair',
        BUILD: 'build',
        UPGRADE: 'upgrade',
        RESERVE: 'reserve',
        GUARD: 'guard',
        SPAWN: 'spawn'
    },

    // 房间状态
    ROOM_STATUS: {
        NORMAL: 'normal',
        UNDER_ATTACK: 'underAttack',
        EXPANDING: 'expanding'
    },

    // 房间类型
    ROOM_TYPE: {
        MAIN: 'main',
        EXTENSION: 'extension'
    },

    // 能量阈值
    ENERGY_THRESHOLDS: {
        LOW: 300,        // 低能量
        MEDIUM: 600,     // 中等能量
        HIGH: 1000,      // 高能量
        CRITICAL: 150    // 严重不足
    }
};
