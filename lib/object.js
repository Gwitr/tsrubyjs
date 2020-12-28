import * as exc from './errors.js';

export var BaseClass = undefined;
export var Module = undefined;

export class RubyObject {
    constructor(type, collect=true) {
        if (type === undefined) {
            this.type = BaseClass;
        } else {
            this.type = type;
        }
        this.included = [];
        this.extended = [];

        if (!(this.type instanceof RubyClass || this.type === undefined)) {
            throw new TypeError("Ruby object type must inherit from JS RubyClass");
        }

        if (this.type === undefined) {
            this.public_methods = {};
            this.private_methods = {};
            this.protected_methods = {};
        } else {
            if (this.type instanceof Object) {
                this.extended = this.type.included;
            }
            if (collect) {
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
            } else {
                this.public_methods = {};
                this.private_methods = {};
                this.protected_methods = {};
            }
        }

        this.ivars = {};
        this.consts = {};

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

    _method_wrapper(type, name, ctx) {
        return (env, ...args) => {
            let f = type[name];
            if (f.bound_to !== undefined) {
                env.object_stack.push(f.bound_to);
            }
            // debugger;
            let result = f.call(ctx, env, ...args);
            if (f.bound_to !== undefined) {
                env.object_stack.pop();
            }
            return result;
        };
    }
    
    _module_imethod_wrapper(method, ctx) {
        return (env, ...args) => {
            let f = method;
            env.object_stack.push(ctx);
            let result = f.call(ctx, env, ...args);
            env.object_stack.pop();
            return result;
        };
    }

    methods(name, ctx) {
        if (ctx === undefined) {
            ctx = this;
        }
        
        // Look up method in this object
        if (name in this.public_methods) {
            return this._method_wrapper(this.public_methods, name, ctx); 
        }
        if ((name in this.protected_methods) && this.allow_protected_access) {
            return this._method_wrapper(this.protected_methods, name, ctx); 
        }
        if ((name in this.private_methods) && this.allow_private_access) {
            return this._method_wrapper(this.private_methods, name, ctx); 
        }
        
        // Look up method in extended modules
        // console.trace();
        for (let module of this.extended) {
            // console.log(module);
            try {
                return this._module_imethod_wrapper(module.get_public_imethod(name), ctx);
            } catch (e) {
                if (!((e instanceof exc.NoType) || (e instanceof exc.NoMethodError))) {
                    throw e;
                }
            }
        }
        // console.log("====");
        
        // Look up method in parent object
        try {
            let base = this.get_base();
            if (base === null) {
                throw new exc.NoMethodError(name);
            }
            return base.methods(name, ctx);
        } catch (e) {
            if (!((e instanceof exc.NoType) || (e instanceof exc.NoMethodError))) {
                throw e;
            }
        }
        
        // Lookup failed
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

    has_method(name) {
        if (this.public_methods.hasOwnProperty(name))
            return true;
        if (this.private_methods.hasOwnProperty(name))
            return true;
        if (this.protected_methods.hasOwnProperty(name))
            return true;
        return false;
    }
}

export class RubyClass extends RubyObject {
    constructor(_type=undefined) {
        super(_type);

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
        
        // This might be incorrect!
        cls.public_methods = {};
        cls.private_methods = {};
        cls.protected_methods = {};
        
        cls.base = this;
        cls.name = name;
        return cls;
    }

    _get_bhier(n, sn) {
        // console.log(this[n], sn);
        if (sn in this[n]) {
            return this[n][sn];
        }
        let bc = this.get_base();
        if (!(bc instanceof Object)) {
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
        // Look for method in inheritance chain
        try {
            return this._get_bhier("public_imethods", name);
        } catch (e) {
            if (!(e instanceof exc.NoMethodError)) {
                throw e;
            }
        }
        
        // Look up method in extended modules
        for (let module of this.extended) {
            try {
                return this._module_imethod_wrapper(module.get_public_imethod(name), ctx);
            } catch (e) {
                if (!((e instanceof exc.NoType) || (e instanceof exc.NoMethodError))) {
                    throw e;
                }
            }
        }
        
        throw new exc.NoMethodError(name);
    }
    get_private_imethod(name) {
        return this._get_bhier("private_imethods", name);
    }
    get_protected_imethod(name) {
        return this._get_bhier("protected_imethods", name);
    }

    // TODO: Figure out why these functions exist
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
    
    include(module) {
        this.included.push(module);
    }
    
    extend(module) {
        this.extended.push(module);
    }
}

BaseClass = new RubyClass();
BaseClass.type = BaseClass;
BaseClass.name = "Class";
BaseClass.public_methods = {
    "new": function(env, ...args) {
        if (this.fast_new !== undefined) {
            return this.fast_new(env, ...args);
        }
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
};

Module = new RubyClass();
Module.name = "Module";
Module.create = function(name) {
    let m = new RubyClass(Module);
    m.name = name;
    m.subclass = function (name) {
        throw new Error("Cannot subclass Module instance");
    };
    m.create = function (name) {
        throw new Error("Cannot create a Module from a Module instance; use Module.create instead");
    };
    return m;
};
Module.subclass = function (name) {
    throw new Error("Cannot subclass Module, use Module.create instead");
};
Module.public_imethods = [];
Module.private_imethods = [];
Module.protected_imethods = [];