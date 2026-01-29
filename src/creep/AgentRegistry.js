/**
 * AgentRegistry
 * 负责管理所有 Agent 的创建、缓存与刷新。
 */

const Agent = require('./Agent');

const AgentRegistry = {
    /** @type {Object.<string, Agent>} */
    _agentsByName: {},

    /**
     * 获取指定 creep 的 Agent（懒创建+缓存）。
     * @param {Creep|string} creepOrName
     * @returns {Agent|null}
     */
    get(creepOrName) {
        let name;
        let creep = null;

        if (typeof creepOrName === 'string') {
            name = creepOrName;
            creep = Game.creeps[name] || null;
        } else if (creepOrName && creepOrName.name) {
            creep = creepOrName;
            name = creepOrName.name;
        }

        if (!name) return null;
        if (!creep) {
            creep = Game.creeps[name] || null;
            if (!creep) return null;
        }

        let agent = this._agentsByName[name];
        if (!agent) {
            agent = new Agent(creep);
            this._agentsByName[name] = agent;
        }
        return agent;
    },

    /**
     * 每 tick 刷新所有 Agent，并为所有现存 creep 确保有 Agent。
     * 在主循环早期调用一次即可。
     */
    refreshAll() {
        const namesInGame = {};

        // 先遍历 Game.creeps，确保每个存活的 creep 都有 Agent
        for (const name in Game.creeps) {
            namesInGame[name] = true;
            if (!this._agentsByName[name]) {
                const creep = Game.creeps[name];
                this._agentsByName[name] = new Agent(creep);
            } else {
                this._agentsByName[name].refresh();
            }
        }

        // 清理已经死亡的 creep 对应的 Agent
        for (const name in this._agentsByName) {
            if (!namesInGame[name]) {
                delete this._agentsByName[name];
            }
        }

        // 可选：暴露到全局，方便在控制台调试
        if (!global.Agents) {
            global.Agents = this._agentsByName;
        } else {
            global.Agents = this._agentsByName;
        }
    }
};

module.exports = AgentRegistry;

