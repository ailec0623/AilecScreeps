# 与 Overmind 的对比分析

本文档对比当前项目实现与 Overmind 的实现，找出可以提升的地方。

## 1. 架构设计对比

### Overmind 的架构
```
Overmind (全局)
  └── Overseer (调度器)
      └── Colony (殖民地)
          ├── HiveCluster (集群组件)
          │   ├── Hatchery (孵化场)
          │   ├── CommandCenter (指挥中心)
          │   ├── EvolutionChamber (进化室)
          │   └── SporeCrawler (孢子爬虫/塔)
          ├── Overlord (监督者)
          │   └── Zerg (Creep包装类)
          └── LogisticsNetwork (物流网络)
```

### 当前项目的架构
```
ColonyManager (殖民地管理器)
  └── Room (房间)
      ├── SpawnManager (生成管理器)
      ├── CreepManager (Creep管理器)
      ├── TaskGenerator (任务生成器)
      └── RoomController (房间控制器)
```

### 改进建议

#### 1.1 引入 Overlord 模式
**优势：**
- Overlord 作为 Creep 的"监督者"，负责管理一组相关 Creep
- 每个 Overlord 有明确的职责（如 MiningOverlord、TransportOverlord）
- 支持优先级系统和暂停机制

**实现建议：**
```javascript
// 创建 Overlord 基类
class Overlord {
    constructor(colony, name, priority) {
        this.colony = colony;
        this.name = name;
        this.priority = priority;
        this.creeps = {}; // 按角色分组的 Creep
    }
    
    init() {} // 初始化阶段：生成请求、分配任务
    run() {}  // 运行阶段：执行逻辑
}
```

#### 1.2 引入 HiveCluster 概念
**优势：**
- 将相关结构组织在一起（如 Hatchery 包含 spawns、extensions、link）
- 每个集群有独立的逻辑和状态管理
- 更好的模块化和可扩展性

**实现建议：**
```javascript
class HiveCluster {
    constructor(colony, anchor, name) {
        this.colony = colony;
        this.anchor = anchor;
        this.name = name;
        this.structures = {}; // 相关结构
    }
    
    init() {} // 初始化
    run() {}  // 运行
}
```

## 2. Creep 管理对比

### Overmind 的 Zerg 系统
- **Zerg 包装类**：封装 Creep，提供丰富的扩展方法
- **任务系统**：每个 Zerg 有 `task` 属性，任务自动处理移动和操作
- **自动刷新**：每 tick 自动刷新状态
- **行动日志**：跟踪已执行的操作，避免冲突

### 当前项目的 Creep 管理
- **原型扩展**：直接在 Creep 原型上添加方法
- **任务系统**：通过 `acceptTask()` 和 `operate()` 方法
- **手动管理**：需要手动调用方法

### 改进建议

#### 2.1 引入 Zerg 包装类
**优势：**
- 更好的封装和类型安全
- 统一的接口和扩展方法
- 自动状态管理

**实现建议：**
```javascript
class Zerg {
    constructor(creep) {
        this.creep = creep;
        this.name = creep.name;
        this.role = creep.memory.role;
        this.task = null;
        this.actionLog = {};
    }
    
    refresh() {
        // 自动刷新状态
        this.creep = Game.creeps[this.name];
        if (!this.creep) {
            // Creep 已死亡，清理
            delete Overmind.zerg[this.name];
            return;
        }
        // 更新属性
    }
    
    run() {
        if (this.task) {
            this.task.run();
        }
    }
}
```

#### 2.2 改进任务系统
**优势：**
- 任务对象封装了目标、移动和操作逻辑
- 支持任务链（parent task）
- 自动处理无效任务

**实现建议：**
```javascript
class Task {
    constructor(name, target, options) {
        this.name = name;
        this.target = target;
        this.creep = null;
        this.settings = {
            targetRange: 1,
            workOffRoad: false,
            oneShot: false,
            timeout: Infinity
        };
    }
    
    isValid() {
        // 检查任务是否仍然有效
    }
    
    run() {
        // 执行任务：移动到目标 -> 执行操作
        if (!this.isValid()) {
            this.creep.task = null;
            return;
        }
        
        if (this.creep.pos.inRangeTo(this.target.pos, this.settings.targetRange)) {
            return this.work();
        } else {
            return this.creep.goTo(this.target);
        }
    }
    
    work() {
        // 子类实现具体操作
    }
}
```

## 3. 任务系统对比

### Overmind 的任务系统
- **任务类继承**：每种任务类型是一个类（TaskHarvest、TaskBuild、TaskUpgrade等）
- **任务工厂**：通过 `initializeTask()` 从内存恢复任务对象
- **任务链**：支持 parent task，任务完成后自动切换到父任务
- **自动移动**：任务自动处理移动到目标位置的逻辑

### 当前项目的任务系统
- **任务对象**：简单的内存对象，包含类型、目标等信息
- **行为分离**：任务行为在 `TaskBehaviors` 中实现
- **手动处理**：Creep 需要手动调用 `acceptTask()` 和 `operate()`

### 改进建议

#### 3.1 实现任务类系统
```javascript
// 基础任务类
class Task {
    constructor(name, target, options) {
        this.name = name;
        this.target = target;
        this.creep = null;
    }
    
    isValid() { return true; }
    run() {}
    work() { return OK; }
}

// 具体任务类
class TaskHarvest extends Task {
    constructor(source) {
        super('harvest', source);
    }
    
    isValid() {
        return this.target && this.target.energy > 0;
    }
    
    work() {
        return this.creep.harvest(this.target);
    }
}

class TaskBuild extends Task {
    constructor(site) {
        super('build', site);
        this.settings.targetRange = 3;
    }
    
    isValid() {
        return this.target && this.target.progress < this.target.progressTotal;
    }
    
    work() {
        return this.creep.build(this.target);
    }
}
```

#### 3.2 任务工厂模式
```javascript
class TaskFactory {
    static createTask(protoTask) {
        const taskName = protoTask.name;
        const target = Game.getObjectById(protoTask.targetId);
        
        switch (taskName) {
            case 'harvest':
                return new TaskHarvest(target);
            case 'build':
                return new TaskBuild(target);
            case 'upgrade':
                return new TaskUpgrade(target);
            // ...
        }
    }
}
```

## 4. 物流系统对比

### Overmind 的物流系统
- **LogisticsNetwork**：使用稳定匹配算法（Gale-Shapley）匹配请求和运输者
- **请求系统**：结构可以请求资源输入/输出
- **智能匹配**：考虑距离、容量、优先级等因素
- **LinkNetwork**：专门的 Link 网络管理

### 当前项目的物流系统
- **任务驱动**：通过任务系统处理资源运输
- **简单匹配**：Carrier 接受 pickup/delivery 任务

### 改进建议

#### 4.1 引入物流网络
```javascript
class LogisticsNetwork {
    constructor(colony) {
        this.colony = colony;
        this.requests = []; // 资源请求列表
        this.transporters = []; // 运输者列表
    }
    
    requestInput(target, resourceType, amount, priority = 1) {
        // 注册输入请求
        this.requests.push({
            type: 'input',
            target,
            resourceType,
            amount,
            priority
        });
    }
    
    requestOutput(target, resourceType, amount, priority = 1) {
        // 注册输出请求
        this.requests.push({
            type: 'output',
            target,
            resourceType,
            amount,
            priority
        });
    }
    
    match() {
        // 使用稳定匹配算法匹配请求和运输者
        // 考虑距离、容量、优先级
    }
}
```

## 5. 生成系统对比

### Overmind 的生成系统
- **Hatchery**：专门的孵化场组件，管理所有 spawns 和 extensions
- **SpawnRequest**：Overlord 提交生成请求，包含 setup、priority、options
- **优先级队列**：按优先级排序的生成队列
- **CreepSetup**：可配置的 Creep 身体部件生成器

### 当前项目的生成系统
- **SpawnManager**：管理生成逻辑
- **SpawnScheduler**：生成队列调度
- **BodyBuilder**：身体部件构建器

### 改进建议

#### 5.1 引入 CreepSetup 系统
```javascript
class CreepSetup {
    constructor(role, bodyGenerator) {
        this.role = role;
        this.generateBody = bodyGenerator;
    }
    
    static harvester(energyCapacity) {
        return new CreepSetup('harvester', (energy) => {
            // 根据能量生成身体部件
            const body = [];
            const workParts = Math.floor(energy / 100);
            const carryParts = Math.min(workParts, 2);
            const moveParts = Math.ceil((workParts + carryParts) / 2);
            
            for (let i = 0; i < workParts; i++) body.push(WORK);
            for (let i = 0; i < carryParts; i++) body.push(CARRY);
            for (let i = 0; i < moveParts; i++) body.push(MOVE);
            
            return body;
        });
    }
}
```

#### 5.2 改进生成请求系统
```javascript
class SpawnRequest {
    constructor(setup, overlord, priority, options = {}) {
        this.setup = setup;      // CreepSetup
        this.overlord = overlord; // 请求的 Overlord
        this.priority = priority; // 优先级
        this.options = options;   // 额外选项
    }
}

class Hatchery {
    enqueue(request) {
        // 添加到优先级队列
        if (!this.queue[request.priority]) {
            this.queue[request.priority] = [];
        }
        this.queue[request.priority].push(request);
    }
    
    processQueue() {
        // 按优先级处理队列
        const priorities = Object.keys(this.queue).sort((a, b) => a - b);
        for (const priority of priorities) {
            const requests = this.queue[priority];
            for (const request of requests) {
                if (this.canSpawn(request)) {
                    this.spawn(request);
                    requests.shift();
                    break;
                }
            }
        }
    }
}
```

## 6. 缓存系统对比

### Overmind 的缓存系统
- **GlobalCache ($)**：使用装饰器模式，延迟计算和缓存
- **GameCache**：游戏对象的缓存，按房间、类型分组
- **自动刷新**：每 tick 自动刷新缓存

### 当前项目的缓存系统
- **GameCache**：游戏对象缓存
- **GlobalCache**：全局缓存
- **手动刷新**：需要手动调用 refresh()

### 改进建议

#### 6.1 引入延迟计算缓存
```javascript
// 使用装饰器模式实现延迟计算
const $ = {
    set(obj, prop, getter, ttl = 1) {
        let cache = obj._$cache || (obj._$cache = {});
        let cached = cache[prop];
        
        if (!cached || cached.tick < Game.time - ttl) {
            cached = {
                value: getter(),
                tick: Game.time
            };
            cache[prop] = cached;
        }
        
        return cached.value;
    },
    
    refresh(obj, ...props) {
        const cache = obj._$cache;
        if (!cache) return;
        
        for (const prop of props) {
            delete cache[prop];
        }
    }
};

// 使用示例
class Colony {
    get sources() {
        return $.set(this, 'sources', () => {
            return this.room.find(FIND_SOURCES);
        }, 1);
    }
}
```

## 7. 移动系统对比

### Overmind 的移动系统
- **Movement 类**：统一的移动逻辑
- **路径缓存**：缓存路径，避免重复计算
- **多房间路径**：支持跨房间路径规划
- **特殊移动**：flee、kite、park 等特殊移动模式

### 当前项目的移动系统
- **CreepExtensions**：在 Creep 原型上添加移动方法
- **基础移动**：基本的 goTo 方法

### 改进建议

#### 7.1 实现统一的移动系统
```javascript
class Movement {
    static goTo(creep, target, options = {}) {
        // 统一的移动逻辑
        // 支持路径缓存、多房间路径等
    }
    
    static flee(creep, threats, options = {}) {
        // 逃跑逻辑
    }
    
    static kite(creep, threats, options = {}) {
        // 风筝逻辑
    }
    
    static park(creep, pos, options = {}) {
        // 停靠逻辑
    }
}
```

## 8. 防御系统对比

### Overmind 的防御系统
- **SporeCrawler**：塔的专门管理类
- **智能目标选择**：考虑伤害、治疗、威胁等级
- **DEFCON 系统**：防御等级系统
- **自动安全模式**：根据威胁自动激活安全模式

### 当前项目的防御系统
- **structure.tower.js**：塔的管理
- **基础攻击和修理**：简单的攻击和修理逻辑

### 改进建议

#### 8.1 改进塔的防御逻辑
```javascript
class TowerDefense {
    static selectTarget(tower, hostiles) {
        // 智能选择目标
        // 考虑：
        // 1. 威胁等级（玩家 vs NPC）
        // 2. 伤害潜力
        // 3. 治疗能力
        // 4. 距离和位置
        
        const dangerous = hostiles.filter(h => 
            h.owner.username !== 'Source Keeper' ||
            CombatIntel.getAttackPotential(h) > 0
        );
        
        return maxBy(dangerous, hostile => {
            const damage = CombatIntel.towerDamageAtPos(hostile.pos);
            const healing = CombatIntel.maxHostileHealingTo(hostile);
            return damage - healing;
        });
    }
}
```

## 9. 房间规划对比

### Overmind 的房间规划
- **RoomPlanner**：专门的房间规划类
- **布局系统**：支持多种布局（bunker、twoPart等）
- **自动规划**：自动规划建筑位置
- **BarrierPlanner**：城墙规划

### 当前项目的房间规划
- **RoomPlanner**：预留接口，未实现

### 改进建议

#### 9.1 实现房间规划系统
```javascript
class RoomPlanner {
    constructor(colony) {
        this.colony = colony;
        this.layout = this.determineLayout();
    }
    
    determineLayout() {
        // 根据 RCL、资源等确定布局
        if (this.colony.level >= 8) {
            return 'bunker';
        }
        return 'twoPart';
    }
    
    plan() {
        // 规划建筑位置
        this.planSpawns();
        this.planExtensions();
        this.planStorage();
        this.planLinks();
        // ...
    }
}
```

## 10. 总结：优先改进项

### 高优先级（立即改进）
1. **引入 Zerg 包装类**：统一 Creep 管理接口
2. **实现任务类系统**：改进任务管理和执行
3. **引入 Overlord 模式**：更好的 Creep 组织和管理

### 中优先级（逐步改进）
4. **实现物流网络**：智能资源运输
5. **改进生成系统**：使用 CreepSetup 和 SpawnRequest
6. **实现延迟计算缓存**：优化性能

### 低优先级（长期优化）
7. **实现房间规划系统**：自动建筑规划
8. **改进移动系统**：统一移动逻辑
9. **增强防御系统**：智能防御逻辑

## 11. 实施建议

### 阶段 1：核心重构（1-2周）
- 引入 Zerg 包装类
- 实现任务类系统
- 引入 Overlord 基类

### 阶段 2：系统优化（2-3周）
- 实现物流网络
- 改进生成系统
- 优化缓存系统

### 阶段 3：功能增强（3-4周）
- 实现房间规划
- 改进移动系统
- 增强防御系统

### 注意事项
1. **渐进式迁移**：不要一次性重构所有代码
2. **保持兼容**：确保新系统与旧系统兼容
3. **充分测试**：每个阶段都要充分测试
4. **性能监控**：关注 CPU 使用情况
