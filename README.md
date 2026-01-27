# Screeps 项目结构文档

## 项目概述

这是一个 Screeps（MMO 策略游戏）的自动化脚本项目，使用任务系统（Task System）来管理 creep 的行为和资源分配。

## 核心架构

### 执行流程

```
main.js (入口)
  ├─ tool.run() - 初始化游戏、清理内存
  ├─ RoomControl.mainRoom() - 主房间管理
  ├─ SpawnControl.acceptTask() - 生成 creep
  ├─ ConstructionSites.run() - 建筑工地管理
  ├─ Flags.run() - 旗帜任务管理
  ├─ Structures.run() - 建筑结构管理
  ├─ Task.sortTasks() - 任务排序
  ├─ Creeps.run() - Creep 执行循环
  └─ Task.cancelTask() - 任务清理
```

## 模块分类

### 1. 核心控制模块

#### `main.js` - 主循环入口
- 游戏主循环 `module.exports.loop`
- 协调各模块执行顺序
- 管理主房间列表 `Memory.mainRooms`

#### `mount.js` / `mount.creeps.js` - 原型扩展
- 扩展 `Creep.prototype`，添加自定义方法：
  - `acceptTask()` - 接受任务
  - `operate()` - 执行任务
  - `reviewTask()` - 审查任务状态

### 2. 房间管理模块

#### `room.js` - 房间控制
- `mainRoom()` - 主房间管理
- `extensionRoom()` - 扩展房间管理
- `claimRoom()` - 占领房间
- `destroyRoom()` - 摧毁房间
- `build()` - 自动建造系统（基于旗帜）

#### `tool.js` - 工具函数
- `initGame()` - 初始化游戏内存
- `initHarvesterPosition()` - 初始化采集者位置（红色旗帜）
- `initBuildingPosition()` - 初始化建筑位置（蓝色旗帜）
- `cleanCreeps()` - 清理死亡 creep 的内存
- `getPixels()` - 生成像素
- `upgradWall()` - 升级城墙血量

### 3. 任务系统模块

#### `task.js` - 任务管理核心
- `spawnTasks()` - 生成 creep 任务（根据角色配置）
- `reserveTask()` - 预订控制器任务
- `guardTask()` - 守卫任务
- `repairTask()` - 维修任务
- `destroyTask()` - 摧毁任务
- `initTasks()` - 初始化任务列表
- `sortTasks()` - 按优先级排序任务
- `cancelTask()` - 取消已完成/无效任务

#### `task.releaser.js` - 任务发布器
- `releaseTask()` - 统一任务发布接口
- 支持的任务类型：harvestpro, pickup, delivery, getenergy, repair, build, upgrade, reserve, guard

#### `task.behavior.js` - 任务行为实现
- 各种任务的具体执行逻辑：
  - `harvestPro()` - 专业采集
  - `pickUp()` - 拾取资源
  - `delivery()` - 运输资源
  - `getenergy()` - 获取能量
  - `repair()` - 维修建筑
  - `build()` - 建造建筑
  - `upgrade()` - 升级控制器
  - `reserve()` - 预订控制器
  - `guard()` - 守卫攻击
  - `destroy()` - 摧毁敌对建筑

### 4. Creep 管理模块

#### `creeps.js` - Creep 执行循环
- `run()` - 遍历所有 creep，执行任务循环

#### `creeps.scripts.js` - Creep 脚本逻辑
- `acceptTask()` - 根据角色接受任务
- `operate()` - 执行任务操作
- `reviewTask()` - 审查并完成任务

支持的 Creep 角色：
- `harvesterpro` - 专业采集者
- `carrier` - 运输者
- `worker` - 工人（建造/维修/升级）
- `reserver` - 预订者
- `guard` - 守卫
- `conqueror` - 征服者
- `claimer` - 占领者
- `getpower` - 获取能量

### 5. 生成系统模块

#### `spawn.js` - Creep 生成器
- `acceptTask()` - 接受生成任务
- `generator()` - 生成逻辑分发
- `assumbleSpawn()` - 自动组装生成（根据能量动态调整）
- `nomalSpawn()` - 标准生成（使用固定配置）
- `calculateCost()` - 计算身体部件成本

#### `role.config.js` - 角色配置
- 各角色在不同控制器等级下的配置：
  - `num` - 数量
  - `mod` - 身体部件配置
  - `auto` - 自动模式配置（base, extend, max）

### 6. 建筑管理模块

#### `structures.js` - 建筑结构管理
- `run()` - 遍历所有建筑，生成相应任务
- `controllerTasks()` - 控制器升级任务
- `storageTasks()` - 存储任务
- `deliveryTasks()` - 运输任务
- `pickupTasks()` - 拾取任务

#### `structure.tower.js` - 防御塔逻辑
- `run()` - 防御塔运行逻辑
- `attackCreeps()` - 攻击敌对 creep
- `repairStructures()` - 维修建筑（优先非城墙）

#### `structure.count.js` - 建筑数量配置
- 各控制器等级下各类型建筑的目标数量

#### `structure.observer.js` - 观察者逻辑
- 观察房间，寻找能量银行（Power Bank）

### 7. 辅助模块

#### `flags.js` - 旗帜管理
- `harvestproTasks()` - 根据红色旗帜生成采集任务
- `pickupTasks()` - 根据红色旗帜生成拾取任务

#### `constructionsites.js` - 建筑工地管理
- `run()` - 为所有建筑工地生成建造任务

## 数据流

### 任务生命周期

```
1. 任务生成 (Task/Structures/Flags/ConstructionSites)
   └─> 发布到 Memory.rooms[room].tasks[type]
   
2. 任务排序 (Task.sortTasks)
   └─> 按 priority 排序
   
3. Creep 接受任务 (Creep.acceptTask)
   └─> 绑定 creepId，设置 inTask = true
   
4. Creep 执行任务 (Creep.operate)
   └─> 调用 task.behavior 中的对应方法
   
5. 任务审查 (Creep.reviewTask)
   └─> 检查任务完成条件，释放任务
   
6. 任务清理 (Task.cancelTask)
   └─> 清理死亡 creep/建筑的任务
```

### 内存结构

```
Memory
├─ mainRooms: [] - 主房间列表
├─ rooms: {
│   └─ [roomName]: {
│       ├─ tasks: {
│       │   ├─ spawn: [] - 生成任务
│       │   ├─ harvestpro: [] - 采集任务
│       │   ├─ pickup: [] - 拾取任务
│       │   ├─ delivery: [] - 运输任务
│       │   ├─ getenergy: [] - 获取能量任务
│       │   ├─ repair: [] - 维修任务
│       │   ├─ build: [] - 建造任务
│       │   ├─ upgrade: [] - 升级任务
│       │   ├─ reserve: [] - 预订任务
│       │   └─ guard: [] - 守卫任务
│       ├─ extension: [] - 扩展房间列表
│       ├─ destroy: [] - 摧毁目标房间
│       ├─ claimRoom: "" - 占领目标房间
│       ├─ buildings: {} - 建筑计数
│       ├─ firstSpawn: {} - 第一个 spawn 位置
│       ├─ centralLink: "" - 中央 link ID
│       └─ wallHits: number - 城墙目标血量
│   }
└─ creeps: {} - Creep 内存（自动管理）
```

## 设计模式

1. **任务队列模式** - 使用优先级队列管理任务分配
2. **原型扩展模式** - 通过 mount 扩展游戏原生对象
3. **配置驱动** - 通过 role.config.js 配置不同等级的策略
4. **模块化设计** - 各功能模块独立，通过 require 组织

## 特色功能

1. **自动建造系统** - 基于旗帜的自动建筑布局
2. **动态身体组装** - 根据可用能量自动调整 creep 身体部件
3. **多房间管理** - 支持主房间和扩展房间的协调管理
4. **任务优先级系统** - 通过 priority 字段控制任务执行顺序
5. **扩展房间支持** - 支持预订和守卫扩展房间

## 文件结构

```
.
├── main.js                    # 主循环入口
├── mount.js                   # 原型扩展入口
├── mount.creeps.js            # Creep 原型扩展
├── tool.js                    # 工具函数
├── room.js                    # 房间管理
├── creeps.js                  # Creep 执行循环
├── creeps.scripts.js          # Creep 脚本逻辑
├── task.js                    # 任务管理核心
├── task.releaser.js           # 任务发布器
├── task.behavior.js           # 任务行为实现
├── spawn.js                   # Creep 生成器
├── role.config.js             # 角色配置
├── structures.js               # 建筑结构管理
├── structure.tower.js          # 防御塔逻辑
├── structure.count.js          # 建筑数量配置
├── structure.observer.js       # 观察者逻辑
├── flags.js                   # 旗帜管理
└── constructionsites.js        # 建筑工地管理
```

## 使用说明

1. **初始化房间**：首次运行时，系统会自动初始化主房间的内存结构
2. **设置旗帜**：
   - 红色旗帜：标记采集者位置（在能量源附近）
   - 蓝色旗帜：标记建筑位置（根据建筑类型使用不同颜色）
3. **配置角色**：在 `role.config.js` 中调整各角色的数量和身体部件配置
4. **扩展房间**：在房间内存中设置 `extension` 数组来管理扩展房间

## 注意事项

- 确保 `Memory.mainRooms` 中包含所有主房间名称
- 建筑布局通过旗帜系统自动管理，请按照 `tool.js` 中的布局图放置旗帜
- 任务系统会自动管理任务的生命周期，无需手动干预
- 城墙血量会根据存储能量自动升级
