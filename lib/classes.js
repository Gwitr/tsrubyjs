import { BaseClass, RubyClass, RubyObject } from './object.js';
import * as exc from './errors.js';
import * as modules from './modules.js';

export var ObjectClass = BaseClass.subclass("Object");
ObjectClass.extend(modules.kernel);
ObjectClass.public_imethods = {
    "to_s": function(env) {
        return StringClass.methods("new")(env, `#<${this.name}>`);
    },
    "inspect": function(env) {
        if (this.public_methods["to_s"] !== ObjectClass.public_imethods["to_s"]) {
            return this.public_methods["to_s"]();
        }
        // TODO: Add instance variables to the output
        return StringClass.methods("new")(env, `#<${this.name}>`);
    },
    "==": function(env, other) {
        return this === other;
    },
    "!=": function(env, other) {
        return this !== other;
    },
    "class": function(env, other) {
        return this.get_type();
    },
    "superclass": function(env, other) {
        return this.get_base();
    }
}

export var IntegerClass = ObjectClass.subclass("Integer");
IntegerClass.public_imethods = {
    "initialize": function(env, ...args) {
        // console.log(this);
        if (args[0] instanceof RubyObject) {
            if (args[0].type === IntegerClass) {
                args[0] = args[0].i;
            }
        }
        this.i = BigInt(args[0]);
        return env._T(env, null);
    },
    "to_s": function(env, ...args) {
        return StringClass.methods("new")(env, this.i.toString());
    },

    "+": function(env, other) {
        return int_js2ruby(env, this.i + int_js2ruby(env, other).i);
    },
    "-": function(env, other) {
        return int_js2ruby(env, this.i - int_js2ruby(env, other).i);
    },
    "*": function(env, other) {
        return int_js2ruby(env, this.i * int_js2ruby(env, other).i);
    },
    "/": function(env, other) {
        return int_js2ruby(env, this.i / int_js2ruby(env, other).i);
    },

    ">": function(env, other) {
        return this.i > (int_js2ruby(env, other).i);
    },
    "<": function(env, other) {
        return this.i < (int_js2ruby(env, other).i);
    },
    ">=": function(env, other) {
        return this.i >= (int_js2ruby(env, other).i);
    },
    "<=": function(env, other) {
        return this.i <= (int_js2ruby(env, other).i);
    },
    "==": function(env, other) {
        return this.i == (int_js2ruby(env, other).i);
    },
    "!=": function(env, other) {
        return this.i != (int_js2ruby(env, other).i);
    },

    "times": function(env, other) {
        for (let i = 0; i < this.i; i++) {
            env.block.methods("call")(env, int_js2ruby(env, i));
        }
    }
};

export var FloatClass = ObjectClass.subclass("Integer");
FloatClass.public_imethods = {
    "initialize": function(env, ...args) {
        // console.log(this);
        if (args[0] instanceof RubyObject) {
            if (args[0].type === FloatClass) {
                args[0] = args[0].f;
            }
        }
        this.f = Number(args[0]);
        return env._T(env, null);
    },
    "to_s": function(env, ...args) {
        return StringClass.methods("new")(env, this.f.toString());
    },

    "+": function(env, other) {
        return FloatClass.methods("new")(env, this.f + FloatClass.methods("new")(env, other).f);
    },
    "-": function(env, other) {
        return FloatClass.methods("new")(env, this.f - FloatClass.methods("new")(env, other).f);
    },
    "*": function(env, other) {
        return FloatClass.methods("new")(env, this.f * FloatClass.methods("new")(env, other).f);
    },
    "/": function(env, other) {
        return FloatClass.methods("new")(env, this.f / FloatClass.methods("new")(env, other).f);
    },

    ">": function(env, other) {
        return this.f > (FloatClass.methods("new")(env, other).f);
    },
    "<": function(env, other) {
        return this.f < (FloatClass.methods("new")(env, other).f);
    },
    ">=": function(env, other) {
        return this.f >= (FloatClass.methods("new")(env, other).f);
    },
    "<=": function(env, other) {
        return this.f <= (FloatClass.methods("new")(env, other).f);
    },
    "==": function(env, other) {
        return this.f == (FloatClass.methods("new")(env, other).f);
    },
    "!=": function(env, other) {
        return this.f != (FloatClass.methods("new")(env, other).f);
    },

    "times": function(env, other) {
        for (let i = 0; i < this.i; i++) {
            env.block.methods("call")(env, int_js2ruby(env, i));
        }
    }
};

export const INTEGER_CACHE_MIN = -1000;
export const INTEGER_CACHE_MAX =  1000;
export function int_js2ruby(env, i) {
    if (i instanceof RubyObject) {
        if (i.type == IntegerClass) {
            return i;
        }
    }
    if (env.INTEGER_CACHE !== undefined) {
        if (i >= INTEGER_CACHE_MIN && i <= INTEGER_CACHE_MAX) {
            return env.INTEGER_CACHE[Number(i) - INTEGER_CACHE_MIN];
        }
    }
    return IntegerClass.methods("new")(env, i);
}

// TODO: Make Array include Enumerable
export var ArrayClass = ObjectClass.subclass("Array");
ArrayClass.public_imethods = {
    "initialize": function(env, rc=null, rv=null) {
        if (rc instanceof Array) {
            this.a = rc;
        } else {
            let repeat = env._T(env, rc);
            let repeat_value = env._T(env, rv);

            this.a = [];
            if (env.block !== null) {
                for (let i = 0; i < repeat.i; i++) {
                    this.a.push(env.block.methods("call")(env, IntegerClass.methods("new")(env, i)));
                }
            } else if (repeat !== RubyNil) {
                for (let i = 0; i < repeat.i; i++) {
                    this.a.push(repeat_value);
                }
            }
        }
        return env._T(env, null);
    },

    "to_s": function(env) {
        return StringClass.methods("new")(env, this.a.join("\n"));
    },

    "inspect": function(env) {
        return StringClass.methods("new")(env, "[" + this.a.join(", ") + "]");
    },

    "+": function(env, other) {
        let res = [];
        for (let i of this.a) {
            res.push(i);
        }
        for (let i of other.a) {
            res.push(i);
        }
        return ArrayClass.methods("new")(env, res);
    },

    "-": function(env, other) {
        let res = [];
        for (let i of this.a) {
            if (other.a.includes(i)) {
                continue;
            }
            res.push(i);
        }
        return ArrayClass.methods("new")(env, res);
    },

    "*": function(env, other) {
        let res = [];
        for (let i of this.a) {
            for (var j = 0; j < other.i; j++) {
                res.push(i);
            }
        }
        return ArrayClass.methods("new")(env, res);
    },

    "==": function(env, other) {
        if (this.a.length != other.a.length) {
            return false;
        }
        for (var i = 0; i < this.a.length; i++) {
            if (this.a[i] != other.a[i]) {
                return false;
            }
        }
        return true;
    },

    "!=": function(env, other) {
        return !(ArrayClass.methods("==")(env, other));
    },

    "<<": function(env, object) {
        this.a.push(object);
    },

    "[]": function(env, index) {
        return this.a[index];
    },

    "[]=": function(env, index, other) {
        this.a[index] = other;
    },

    "each": function(env) {
        let block = env.block;
        env.block = null;

        for (let i of this.a) {
            block.methods("call")(env, i);
        }
        return this;
    },

    "each_with_index": function(env) {
        let block = env.block;
        env.block = null;

        for (var i = 0; i < this.a.length; i++) {
            block.methods("call")(env, this.a[i], IntegerClass.methods("new")(env, i));
        }
        return this;
    }
};

export var RangeClass = ObjectClass.subclass("Range");
RangeClass.public_imethods = {
    "initialize": function(env, fn, tn, include_last) {
        this.fn = fn
        this.tn = tn
        this.include_last = include_last;
        
        return env._T(env, null);
    },

    "to_s": function(env) {
        if (this.include_last) {
            return StringClass.methods("new")(env, this.fn + ".." + this.tn);
        } else {
            return StringClass.methods("new")(env, this.fn + "..." + this.tn);
        }
    },

    "each": function(env) {
        let block = env.block;
        env.block = null;

        let ci = int_js2ruby(this.include_last ? 1 : 0);
        for (let i = this.fn; i.methods("<")(env, this.tn.methods("+")(ci)); i = i.methods("+")(int_js2ruby(1))) {
            block.methods("call")(env, i);
        }
        return this;
    },

    "each_with_index": function(env) {
        let block = env.block;
        env.block = null;

        for (var i = 0; i < this.a.length; i++) {
            block.methods("call")(env, this.a[i], IntegerClass.methods("new")(env, i));
        }
        return this;
    }
};

export var StringClass = ObjectClass.subclass("String");
StringClass.public_imethods = {
    "initialize": function(env, other) {
        if (other instanceof RubyObject) {
            this.s = other.methods("to_s")(env).s;
        } else if (other === null) {
            this.s = "nil";
        } else if (other === undefined) {
            this.s = "nil";
        } else {
            this.s = other.toString();
        }
        return env._T(env, null);
    },
    "to_s": function(env, other) {
        return this;
    },
    "+": function(env, other) {
        let other_s = StringClass.methods("new")(env, other);
        return StringClass.methods("new")(env, this.s + other_s.s);
    },
    "*": function(env, other) {
        let result = "";
        for (let i = 0; i < IntegerObject.method("new")(env, other).i; i++) {
            result += this.s;
        }
        return StringClass.methods("new")(env, result);
    },
    "==": function(env, other) {
        return this.s === other.s;
    },
    "!=": function(env, other) {
        return this.s !== other.s;
    }
}

export var SymbolClass = ObjectClass.subclass("Symbol");
SymbolClass.public_imethods = {
    "initialize": function(env, other) {
        if (other instanceof RubyObject) {
            this.s = other.methods("to_s")(env).s;
        } else if (other === null) {
            this.s = "nil";
        } else if (other === undefined) {
            this.s = "nil";
        } else {
            this.s = other.toString();
        }
        return env._T(env, null);
    },
    "to_s": function(env) {
        return this;
    },
    "inspect": function(env) {
        return ":" + this.methods("to_s")(env);
    },
    "+": function(env, other) {
        let other_s = SymbolClass.methods("new")(env, other);
        return SymbolClass.methods("new")(env, this.s + other_s.s);
    },
    "*": function(env, other) {
        let result = "";
        for (let i = 0; i < IntegerObject.method("new")(env, other).i; i++) {
            result += this.s;
        }
        return SymbolClass.methods("new")(env, result);
    },
    "==": function(env, other) {
        return this.s === other.s;
    },
    "!=": function(env, other) {
        return this.s !== other.s;
    }
}

export var BlockClass = ObjectClass.subclass("Proc");
BlockClass.public_imethods = {
    "initialize": function(env, other) {
        // throw new Error();
        this.block = other;
        return env._T(env, null);
    },
    "call": function(env, ...args) {
        try {
            return this.block(env, ...args);
        } catch (e) {
            if (!(e instanceof exc.NextTrigger))
                throw e;

            return e.return_value;
        }
    }
}

export var NilClass = ObjectClass.subclass("NilClass");
NilClass.public_imethods = {
    "nil?": function(env) { return true },
    "inspect": function(env) { return env._T(env, "nil") },
    "to_s": function(env) { return env._T(env, "") }
}

export var HashClass = ObjectClass.subclass("Hash");
HashClass.public_imethods = {
    "initialize": function(env, hash_default=null, _hash=null) {
        if (_hash !== null) {
            this.k = [...Object.keys(_hash)];
            this.v = [...Object.values(_hash)];
        } else {
            this.k = [];
            this.v = [];
        }
        this.hash_default = env._T(env, hash_default);
        return env._T(env, null);
    },

    "to_s": function(env) {
        let result = StringClass.methods("new")(env, "{");
        for (let ki = 0; ki < this.k.length; ki++) {
            result = result.methods("+")(env, StringClass.methods("new")(env, this.k[ki]));
            result = result.methods("+")(env, StringClass.methods("new")(env, "=>"));
            result = result.methods("+")(env, StringClass.methods("new")(env, this.v[ki]));
        }
        return result.methods("+")(env, StringClass.methods("new")(env, "}"));
    },

    "inspect": function(env) {
        return this.methods("to_s")(env);
    },

    "==": function(env, other) {
        for (let ki = 0; ki < this.k.length; ki++) {
            let other_ki = other.k.find(this.k[ki]);
            if (other_ki === undefined) {
                return false;
            }
            if (this.v[ki].methods("!=")(env, other.v[other_ki])) {
                return false;
            }
        }
        return true;
    },

    "!=": function(env, other) {
        return !(this.methods("==")(env, other));
    },

    "[]": function(env, key) {
        let ki = this.k.find(key);
        if (ki === undefined) {
            return this.hash_default;
        }
        return this.v[ki];
    },

    "[]=": function(env, key, value) {
        let ki = this.k.find(key);
        if (ki === undefined) {
            this.k.push(key);
            this.v.push(value);
        } else {
            this.v[ki] = value;
        }
        return env._T(env, null);
    },

    "each": function(env) {
        let block = env.block;
        env.block = null;

        for (let ki = 0; ki < this.k.length; ki++) {
            block.methods("call")(env, this.k[ki], this.v[ki]);
        }
        return this;
    }
};