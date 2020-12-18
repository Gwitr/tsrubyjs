import * as exc from './errors.js';

export var BaseClass = undefined;
export class RubyObject {
    constructor(type) {
        if (type === undefined) {
            this.type = BaseClass;
        } else {
            this.type = type;
        }

        if (!(this.type instanceof RubyClass || this.type === undefined)) {
            throw new TypeError("Ruby object type must inherit from JS RubyClass");
        }

        if (this.type === undefined) {
            this.public_methods = {};
            this.private_methods = {};
            this.protected_methods = {};
        } else {
            this.public_methods = this.type.collect_public_imethods();
            this.private_methods = this.type.collect_private_imethods();
            this.protected_methods = this.type.collect_protected_imethods();

            for (let method in this.public_methods) {
                if (this.public_methods.hasOwnProperty(method)) {
                    this.public_methods[method].bound_to = this;
                }
            }
            for (let method in this.protected_methods) {
                if (this.protected_methods.hasOwnProperty(method)) {
                    this.protected_methods[method].bound_to = this;
                }
            }
            for (let method in this.private_methods) {
                if (this.private_methods.hasOwnProperty(method)) {
                    this.private_methods[method].bound_to = this;
                }
            }
        }

        this.ivars = {};
        this.constants = {};

        if (this.type === undefined) {
            this.name = "BasicObject";
        } else {
            /*
            // wtf why is there a mysterious int with no value appearing???
            if (this.type.name === "Integer")
                debugger;
            */
            this.name = this.type.name;
        }

        // TODO: Make this change depending on the current scope
        this.allow_private_access = true;
        this.allow_protected_access = true;
    }

    methods(name, ctx) {
        if (ctx === undefined) {
            ctx = this;
        }
        if (name in this.public_methods) {
            return (env, ...args) => {
                let f = this.public_methods[name];
                if (f.bound_to !== undefined) {
                    env.object_stack.push(f.bound_to);
                }
                let result = f.call(ctx, env, ...args);
                if (f.bound_to !== undefined) {
                    env.object_stack.pop();
                }
                return result;
            };
        }
        if ((name in this.protected_methods) && this.allow_protected_access) {
            return (env, ...args) => {
                let f = this.protected_methods[name];
                if (f.bound_to !== undefined) {
                    env.object_stack.push(f.bound_to);
                }
                let result = f.call(ctx, env, ...args);
                if (f.bound_to !== undefined) {
                    env.object_stack.pop();
                }
                return result;
            };
        }
        if ((name in this.private_methods) && this.allow_private_access) {
            return (env, ...args) => {
                let f = this.private_methods[name];
                if (f.bound_to !== undefined) {
                    env.object_stack.push(f.bound_to);
                }
                let result = f.call(ctx, env, ...args);
                if (f.bound_to !== undefined) {
                    env.object_stack.pop();
                }
                return result;
            };
        }
        try {
            return this.get_base().methods(name, ctx);
        } catch (e) {
            if (!((e instanceof exc.NoType) || (e instanceof exc.NoMethodError))) {
                throw e;
            }
        }
        throw new exc.NoMethodError(name);
    }

    get_type() {
        throw new exc.NoType("");
    }
    set_type(v) {
        throw new exc.NoType("");
    }

    get_base() {
        if (this instanceof RubyClass) {
            return this.base;
        }
        return this.get_type().base;
    }
    set_base(v) {
        if (this instanceof RubyClass) {
            this.base = v;
            return;
        }
        this.get_type().base = v;
    }
}

export class RubyClass extends RubyObject {
    constructor() {
        super();

        this.public_imethods = {};
        this.private_imethods = {};
        this.protected_imethods = {};

        this.base = null;
    }

    copy() {
        let cls = new RubyClass();
        cls.public_imethods = {...this.public_imethods};
        cls.private_imethods = {...this.private_imethods};
        cls.protected_imethods = {...this.protected_imethods};
        cls.set_base(this.get_base());
        cls.name = this.name;
        return cls;
    }

    subclass(name) {
        let cls = new RubyClass();
        cls.public_imethods = {};
        cls.private_imethods = {};
        cls.protected_imethods = {};
        cls.base = this;
        cls.name = name;
        return cls;
    }

    _get_bhier(n, sn) {
        if (name in this[n]) {
            return this[n][sn];
        }
        let bc = this.get_base();
        if (bc === undefined) {
            throw new exc.NoMethodError(sn);
        }
        return bc._get_bhier(n, sn);
    }
    _set_bhier(n, sn, v) {
        if (name in this[n]) {
            this[n][sn] = v;
        }
        let bc = this.get_base();
        if (bc === undefined) {
            throw new exc.NoMethodError(sn);
        }
        bc._set_bhier(n, sn, v);
    }
    _collect_bhier(n) {
        let res = {};
        let cr = this;
        while (1) {
            let collection = cr[n];
            let collection_new = {};
            for (let oname in collection) {
                if (collection.hasOwnProperty(oname)) {
                    collection_new[oname] = function(...args) { return collection[oname].call(this, ...args) };
                }
            }
            res = {...collection_new, ...res};
            cr = cr.get_base();
            if (cr === null) {
                break;
            }
        }
        return res;
    }

    get_public_imethod(name) {
        return this._get_bhier("public_imethods", name);
    }
    get_private_imethod(name) {
        return this._get_bhier("private_imethods", name);
    }
    get_protected_imethod(name) {
        return this._get_bhier("protected_imethods", name);
    }

    set_public_imethod(name, value) {
        this._set_bhier("public_imethods", name, value);
    }
    set_private_imethod(name, value) {
        this._set_bhier("private_imethods", name, value);
    }
    set_protected_imethod(name, value) {
        this._set_bhier("protected_imethods", name, value);
    }

    collect_public_imethods() {
        return this._collect_bhier("public_imethods");
    }
    collect_private_imethods() {
        return this._collect_bhier("private_imethods");
    }
    collect_protected_imethods() {
        return this._collect_bhier("protected_imethods");
    }
}

BaseClass = new RubyClass();
BaseClass.type = BaseClass;
BaseClass.name = "Class";
BaseClass.public_methods = {
    "new": function(env, ...args) {
        let result = this.methods("allocate")(env);
        result.methods("initialize")(env, ...args);
        return result;
    },
    "allocate": function(env) {
        return new RubyObject(this);
    },
    "copy": function(env) {
        return this.copy();
    },
    "class": function(env, other) {
        return this.get_type();
    },
    "superclass": function(env, other) {
        return this.get_base();
    }
};
BaseClass.public_imethods = {
    "initialize": function(env, ...args) {
        return env._T(env, null);
    }
}
