/**
 * 身体部件成本计算器
 */

class CostCalculator {
    /**
     * 计算身体部件的成本
     * @param {Array<string>} body - 身体部件数组
     * @returns {number} 总成本
     */
    static calculateCost(body) {
        let cost = 0;
        for (const part of body) {
            switch (part) {
                case CARRY:
                case MOVE:
                    cost += 50;
                    break;
                case WORK:
                    cost += 100;
                    break;
                case ATTACK:
                    cost += 80;
                    break;
                case RANGED_ATTACK:
                    cost += 150;
                    break;
                case HEAL:
                    cost += 250;
                    break;
                case CLAIM:
                    cost += 600;
                    break;
                case TOUGH:
                    cost += 10;
                    break;
                default:
                    break;
            }
        }
        return cost;
    }

    /**
     * 计算身体部件的能量效率
     * @param {Array<string>} body - 身体部件数组
     * @returns {number} 效率值（越高越好）
     */
    static calculateEfficiency(body) {
        const cost = this.calculateCost(body);
        if (cost === 0) return 0;
        
        // 计算有效部件数量（排除 TOUGH）
        const effectiveParts = body.filter(part => part !== TOUGH).length;
        return effectiveParts / cost;
    }
}

module.exports = CostCalculator;
