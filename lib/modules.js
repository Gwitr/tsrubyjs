import { BaseClass, Module } from './object.js';
import * as exc from './errors.js';

export var kernel = Module.create("Kernel");
kernel.public_imethods = {
    _halt: function(env) {
        throw new Error("halted");
    },
    attr_accessor: function(env, symbol) {
        if (symbol.type.name !== "Symbol") {
            throw new exc.RubyError("attr_accessor argument 1 must be symbol");
        }
        this.public_imethods[symbol.s] = function(env) {
            return env.getivar(symbol.s);
        };
        this.public_imethods[symbol.s + "="] = function(env, value) {
            env.setivar(symbol.s, value);
            return env._T(env, null);
        };
    },
    attr_reader: function(env, symbol) {
        if (symbol.type.name !== "Symbol") {
            throw new exc.RubyError("attr_accessor argument 1 must be symbol");
        }
        this.public_imethods[symbol.s] = function(env) {
            return env.getivar(symbol.s);
        };
    },
    attr_writer: function(env, symbol) {
        if (symbol.type.name !== "Symbol") {
            throw new exc.RubyError("attr_accessor argument 1 must be symbol");
        }
        this.public_imethods[symbol.s + "="] = function(env, value) {
            env.setivar(symbol.s, value);
            return env._T(env, null);
        };
    }
};