/**
 * 原型扩展入口
 */

const mountCreep = require('./creep/CreepExtensions');

module.exports = function() {
    mountCreep();
};
