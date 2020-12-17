'use strict';

// TODO: Add the boolean types

function RubyNode(type, children=[]) {
    this.type = type;
    this.children = children;
}

class NotImplementedError extends Error {
    constructor(message) {
        super();
        this.name = "NotImplementedError";
        this.message = message;
    }
}

class NextTrigger extends Error {
    constructor(return_value) {
        super();
        this.name = "Ruby runtime error";
        this.message = "next used outside of block";
        this.return_value = return_value;
    }
}

Array.prototype.stack_push = function(value) {
    this.unshift(value);
}

Array.prototype.stack_pop = function() {
    return this.shift();
}

Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
}

function rset(array, name, value) {
    if (value instanceof Function) {
        array[name] = value;
    } else {
        array[name] = function(env) {return value};
    }
}

class NoType extends Error {
    constructor(message) {
        super();
        this.name = "NoType";
        this.message = message;
    }
}

class NoMethodError extends Error {
    constructor(message) {
        super();
        this.name = "[Ruby] NoMethodError";
        this.message = message;
    }
}

class RubyNameError extends Error {
    constructor(message) {
        super();
        this.name = "[Ruby] NameError";
        this.message = message;
    }
}

class RubyEnviroment {
    constructor(rlocals, rglobals, block) {
        this.rlocals = rlocals;
        this.rglobals = rglobals;
        this.block = block;
        this.object_stack = [];
        this.nil_singleton = NilClass.methods("new")(this);
    }
    
    push_empty_object(name="main") {
        let obj = ObjectClass.methods("new")(env);
        obj.name = name;
        this.object_stack.push(obj);
    }
    
    getconst(name) {
        for (let i = this.object_stack.length - 1; i >= 0; i--) {
            let const_f = this.object_stack[i].consts[name];
            if (const_f !== undefined)
                return const_f;
        }
        throw new RubyNameError("Uninitialized constant " + name);
    }
    
    setconst(name, value) {
        let consts = this.object_stack[this.object_stack.length - 1].consts;
        if (consts[name] !== undefined) {
            // TODO: Throw warning instead of error
            throw new RubyNameError("Constant " + name + " already initialized.");
        }
        if (value instanceof Function)
            consts[name] = value;
        else
            consts[name] = function(env) { return value };
    }
    
    getivar(name) {
        for (let i = this.object_stack.length - 1; i >= 0; i--) {
            let ivar = this.object_stack[i].ivars[name];
            if (ivar !== undefined)
                return ivar;
        }
        return _T(this, null);
    }
    
    setivar(name, value) {
        let ivars = this.object_stack[this.object_stack.length - 1].ivars;
        ivars[name] = value;
    }
    
    augment_class(container, name, base, f) {
        if (base === null) {
            base = BaseClass;
        }
        if (container.hasOwnProperty(name)) {
            this.object_stack.push(container[name]);
        } else {
            this.object_stack.push(base.subclass(name));
        }
        let class_locals = f(this);
        let rclass = this.object_stack.pop();
        for (let obj_getter_name in class_locals) {
            if (obj_getter_name in this.rlocals[0])
                continue;
            let obj_getter = class_locals[obj_getter_name];
            
            // FIXME: Don't add local variables into the class' instance methods [!!!]
            if (!rclass.public_methods.hasOwnProperty(obj_getter)) {
                if (!rclass.private_methods.hasOwnProperty(obj_getter)) {
                    if (!rclass.protected_methods.hasOwnProperty(obj_getter)) {
                        rclass.public_imethods[obj_getter_name] = obj_getter;
                    }
                }
            }
        }
        // This might be incorrect
        container[name] = function() { return rclass };
    }
}

var BaseClass = undefined;
class RubyObject {
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
            if (!((e instanceof NoType) || (e instanceof NoMethodError))) {
                throw e;
            }
        }
        throw new NoMethodError(name);
    }
    
    get_type() {
        throw new NoType("");
    }
    set_type(v) {
        throw new NoType("");
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

class RubyClass extends RubyObject {
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
            throw new NoMethodError(sn);
        }
        return bc._get_bhier(n, sn);
    }
    _set_bhier(n, sn, v) {
        if (name in this[n]) {
            this[n][sn] = v;
        }
        let bc = this.get_base();
        if (bc === undefined) {
            throw new NoMethodError(sn);
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
        return _T(env, null);
    }
}

var ObjectClass = BaseClass.subclass("Object");
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

var IntegerClass = ObjectClass.subclass("Integer");
IntegerClass.public_imethods = {
    "initialize": function(env, ...args) {
        // console.log(this);
        if (args[0] instanceof RubyObject) {
            if (args[0].type === IntegerClass) {
                args[0] = args[0].i;
            }
        }
        this.i = BigInt(args[0]);
        return _T(env, null);
    },
    "to_s": function(env, ...args) {
        return StringClass.methods("new")(env, this.i.toString());
    },
    
    "+": function(env, other) {
        return IntegerClass.methods("new")(env, this.i + IntegerClass.methods("new")(env, other).i);
    },
    "-": function(env, other) {
        return IntegerClass.methods("new")(env, this.i - IntegerClass.methods("new")(env, other).i);
    },
    "*": function(env, other) {
        return IntegerClass.methods("new")(env, this.i * IntegerClass.methods("new")(env, other).i);
    },
    "/": function(env, other) {
        return IntegerClass.methods("new")(env, this.i / IntegerClass.methods("new")(env, other).i);
    },
    
    ">": function(env, other) {
        return this.i > (IntegerClass.methods("new")(env, other).i);
    },
    "<": function(env, other) {
        return this.i < (IntegerClass.methods("new")(env, other).i);
    },
    ">=": function(env, other) {
        return this.i >= (IntegerClass.methods("new")(env, other).i);
    },
    "<=": function(env, other) {
        return this.i <= (IntegerClass.methods("new")(env, other).i);
    },
    "==": function(env, other) {
        return this.i == (IntegerClass.methods("new")(env, other).i);
    },
    "!=": function(env, other) {
        return this.i != (IntegerClass.methods("new")(env, other).i);
    },
    
    "times": function(env, other) {
        for (let i = 0; i < this.i; i++) {
            env.block.methods("call")(env, IntegerClass.methods("new")(env, i));
        }
    }
};

// TODO: Make Array inherit from Enumerable instead of Object
var ArrayClass = ObjectClass.subclass("Array");
ArrayClass.public_imethods = {
    "initialize": function(env, rc=null, rv=null) {
        if (rc instanceof Array) {
            this.a = rc;
        } else {
            let repeat = _T(env, rc);
            let repeat_value = _T(env, rv);
            
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
        return _T(env, null);
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
        return ArrayClass.methods("new")(res);
    },
    
    "-": function(env, other) {
        let res = [];
        for (let i of this.a) {
            if (other.a.includes(i)) {
                continue;
            }
            res.push(i);
        }
        return ArrayClass.methods("new")(res);
    },
    
    "*": function(env, other) {
        let res = [];
        for (let i of this.a) {
            for (var j = 0; j < other.i; j++) {
                res.push(i);
            }
        }
        return ArrayClass.methods("new")(res);
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

var StringClass = ObjectClass.subclass("String");
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
        return _T(env, null);
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

var BlockClass = ObjectClass.subclass("Proc");
BlockClass.public_imethods = {
    "initialize": function(env, other) {
        this.block = other;
        return _T(env, null);
    },
    "call": function(env, ...args) {
        try {
            return this.block(env, ...args);
        } catch (e) {
            if (!(e instanceof NextTrigger))
                throw e;
            
            return e.return_value;
        }
    }
}

var NilClass = ObjectClass.subclass("NilClass");
NilClass.public_imethods = {
    "nil?": function(env) { return true },
    "inspect": function(env) { return _T(env, "nil") },
    "to_s": function(env) { return _T(env, "") }
}

function _T(env, primitive) {
    if (typeof primitive === "string") {
        return StringClass.methods("new")(env, primitive);
    
    } else if (typeof primitive === "number") {
        return IntegerClass.methods("new")(env, primitive);
    
    } else if (primitive === null) {
        return env.nil_singleton;
    
    } else if (primitive === undefined) {
        return env.nil_singleton;
    
    } else if (primitive instanceof Array) {
        return ArrayClass.methods("new")(env, primitive);
    
    } else if (primitive instanceof RubyObject) {
        return primitive;
    
    } else {
        throw new NotImplementedError(`lazy af, didn't implement primitive '${typeof primitive}' yet`)
    }
}

function ast_to_function(ast) {
    return new Function("env", `
    'use strict';
    let tmpblock = null;
    let tmpblockres = null;
    ${compile(ast).replaceAll("\n", "\n    ")}`);
}

function compile(ast, pre_return="") {
    // console.log(ast);
    if (ast.type === "send") {
        let args = [];
        for (let arg of ast.children.slice(2)) {
            args.push(compile(arg));
        }
        let name = JSON.stringify(String(ast.children[1]));
        if (ast.children[0] === null) {
            return `env.rlocals[0][${name}](env, ${args.join(', ')})`;
        }
        let object_expr = compile(ast.children[0]);
        return `${object_expr}.methods(${name})(env, ${args.join(', ')})`;
    
    } else if (ast.type == "begin") {
        let res = "(function() {\n    let res;\n";
        for (let expr of ast.children) {
            let c = compile(expr).replaceAll("\n", "\n    ");
            if (c.substr(0, 6) === "return") {
                res += pre_return;
                res += c + ";\n";
            } else {
                res += "    res = " + c + ";\n";
            }
        }
        res += pre_return;
        res += "    return res;\n})()";
        return res;
    
    } else if (ast.type === "str") {
        return "_T(env, " + JSON.stringify(String(ast.children[0])) + ")";
    
    } else if (ast.type === "lvasgn") {
        let name = JSON.stringify(String(ast.children[0]));
        let expr = compile(ast.children[1], pre_return);
        return `rset(env.rlocals[0], ${name}, ${expr})`;
    
    } else if (ast.type === "lvar") {
        let name = JSON.stringify(String(ast.children[0]));
        return `env.rlocals[0][${name}]()`;
    
    } else if (ast.type === "while") {
        let block = compile(new RubyNode("begin", ast.children.slice(1)), pre_return).replaceAll("\n", "\n                ");
        let condition = compile(ast.children[0], pre_return);
        return `(function() {
    let res;
    while (${condition}) {
        res = (function() {
            ${block}
        })();
    }
    return res;
})()`;
    
    } else if (ast.type === "const") {
        let name = JSON.stringify(String(ast.children[1]));
        if (ast.children[0] === null) {
            return `env.getconst(${name})(env)`
        }
        let objexpr = compile(ast.children[0], pre_return);
        return `${objexpr}.consts[${name}](env)`
    
    } else if (ast.type === "ivasgn") {
        let name = JSON.stringify(String(ast.children[0]).substr(1));
        let expr = compile(ast.children[1], pre_return);
        return `env.setivar(${name}, ${expr})`
    
    } else if (ast.type === "ivar") {
        let name = JSON.stringify(String(ast.children[0]).substr(1));
        return `env.getivar(${name})`
    
    } else if (ast.type === "casgn") {
        let name = JSON.stringify(String(ast.children[1]));
        let expr = compile(ast.children[2], pre_return);
        if (ast.children[0] === null) {
            return `env.setconst(${name}, ${expr})`
        }
        let objexpr = compile(ast.children[0], pre_return);
        return `rset(${objexpr}.consts, ${name}, ${expr});`
    
    } else if (ast.type === "if") {
        let block;
        let block_else;
        if (ast.children[1] === null) {
            block = "";
        } else {
            block = compile(ast.children[1], pre_return).replaceAll("\n", "\n            ")
        }
        if (ast.children[2] === null) {
            block_else = "";
        } else {
            block_else = compile(ast.children[2], pre_return).replaceAll("\n", "\n            ");
        }
        let condition = compile(ast.children[0], pre_return);
        
        return `(function() {
    let res = null;
    if (${condition}) {
        res = (function() {
            ${block}
        })();
        return res;
    } else {
        res = (function() {
            ${block_else}
        })();
    }
    return res;
})()`
        
    } else if (ast.type === "gvasgn") {
        let name = JSON.stringify(String(ast.children[0]).substr(1));
        let expr = compile(ast.children[1], pre_return);
        return `env.rglobals[${name}] = ${expr}`;
    
    } else if (ast.type === "gvar") {
        let name = JSON.stringify(String(ast.children[0]).substr(1));
        return `env.rglobals[${name}]`;
    
    } else if (ast.type === "int") {
        return "_T(env, " + JSON.stringify(Number(ast.children[0])) + ")";
        
    } else if (ast.type === "def") {
        let name = ast.children[0];
        
        // Convert the function arguments into code
        let aast = ast.children[1];
        let argname_code = "";
        let argname_list = "";
        let optarg_code = "";
        let blockarg_code = "";
        if (aast.children.length > 0) {
            // TODO: procarg0 should fill missing args with nil but args shouldn't
            if (aast.children[0].type === "procarg0") {
                aast = aast.children[0];
            }
            let name = ast.children[0];
            for (let node of aast.children) {
                let argname = JSON.stringify(String(node.children[0]));
                if (node.type === "arg") {
                    argname_list += "__arg_" + node.children[0] + ", ";
                    argname_code += `rset(env.rlocals[0], ${argname}, _T(env, __arg_${node.children[0]}));\n`;
                } else if (node.type === "blockarg") {
                    blockarg_code = `rset(env.rlocals[0], ${argname}, env.block);\n`;
                } else if (node.type === "optarg") {
                    let optarg_value = compile(node.children[1], pre_return);
                    argname_list += "__arg_" + node.children[0] + ", ";
                    optarg_code += `rset(env.rlocals[0], ${argname}, ${optarg_value});
if (__arg_${node.children[0]} !== undefined)
    rset(env.rlocals[0], ${argname}, _T(env, __arg_${node.children[0]}));
`;
                } else {
                    throw new NotImplementedError(`Unknown argument type "${node.type}"`);
                }
            }
            argname_list = argname_list.substr(0, argname_list.length - 2);
        }
        blockarg_code = blockarg_code.replaceAll("\n", "\n    ");
        optarg_code = optarg_code.replaceAll("\n", "\n    ");
        argname_code = argname_code.replaceAll("\n", "\n    ");
        
        let function_code = compile(ast.children[2], pre_return).replaceAll("\n", "\n    ");
        
        // console.log(env, bound_to, ${argname_list});
        return `env.rlocals[0][${JSON.stringify(String(name))}] = function(env, ${argname_list}) {
    let tmpblock = null;
    let tmpblockres = null;
    env.rlocals.stack_push({...(env.rlocals[0])});
    ${blockarg_code}${optarg_code}${argname_code}let b_retval = ${function_code};
    env.rlocals.stack_pop();
    return b_retval;
}`;
    
    } else if (ast.type === "array") {
        if (ast.children === undefined) {
            return "_T(env, [])";
        }
        let s = [];
        for (let i of ast.children) {
            s.push(compile(i, pre_return));
        }
        return `_T(env, [${s.join(', ')}])`;
        
    } else if (ast.type === "block") {
        let ast2 = new RubyNode("def", ["f&", ast.children[1], ast.children[2]]);
        let args = [];
        for (let arg of ast.children[0].children.slice(2)) {
            args.push(compile(arg));
        }
        let args_s = args.join(', ');
        let name = JSON.stringify(String(ast.children[0].children[1]));
        let code1 = compile(ast2, pre_return).replaceAll("\n", "\n        ");
        if (ast.children[0].children[0] === null) {
            return `(function() {
    let res;
    env.block = BlockClass.methods("new")(env, ${code1});
    res = env.rlocals[0][${name}](env, ${args_s});
    env.block = _T(env, null);
    return res;
})()`;
        } else {
            let code2 = compile(ast.children[0].children[0], pre_return).replaceAll("\n", "\n    ");
            return `(function() {
    let res;
    rset(env.rlocals[0], "&", env.block = BlockClass.methods("new")(env, ${code1}));
    tmpblockres = ${code2};
    env.block = env.rlocals[0]["&"]();
    res = tmpblockres.methods(${name})(env, ${args_s});
    env.block = _T(env, null);
    return res;
})()`;
        }
    
    } else if (ast.type === "op_asgn") {
        let getter;
        if (ast.children[0].type === "lvasgn") {
            getter = new RubyNode("send", [null, ast.children[0].children[0]]);
        } else if (ast.children[0].type === "gvasgn") {
            getter = new RubyNode("gvar", [ast.children[0].children[0]]);
        } else if (ast.children[0].type === "ivasgn") {
            getter = new RubyNode("ivar", [ast.children[0].children[0]]);
        } else if (ast.children[0].type === "casgn") {
            getter = new RubyNode("const", [ast.children[0].children[0], ast.children[0].children[1]]);
        }
        let ast2 = new RubyNode(ast.children[0].type, [
            ...ast.children[0].children,
            new RubyNode("send", [
                getter,
                ast.children[1],
                ast.children[2]
            ])
        ]);
        return compile(ast2, pre_return);
    
    } else if (ast.type === "next") {
        if (ast.children.length > 0) {
            throw new NotImplementedError("next with args not implemented yet");
        }
        return 'throw new NextTrigger(_T(env, null));';
    
    } else if (ast.type === "class") {
        // TODO: Implement private and protected
        let objexpr = `(function() {
    let tmpblock = null;
    let tmpblockres = null;
    env.rlocals.stack_push({...(env.rlocals[0])});
    ${compile(ast.children[2])};
    return env.rlocals.stack_pop();
})`;
        let const_obj = ast.children[0].children[0];
        let const_name = JSON.stringify(String(ast.children[0].children[1]));
        let inh_expr = "null";
        if (ast.children[1] !== null) {
            inh_expr = compile(ast.children[1]);
        }
        if (const_obj === null)
            return `env.augment_class(
    env.object_stack[env.object_stack.length - 1].consts,
    ${const_name},
    ${inh_expr},
    ${objexpr.replaceAll('\n', '\n    ')}
)`;
        return `env.augment_class(
    ${compile(const_obj, pre_return).replaceAll('\n', '\n    ')}.consts, 
    ${const_name}, 
    ${inh_expr},
    ${objexpr}
)`
    
    } else if (ast.type === "return") {
        if (ast.children === null) {
            return `${pre_return}return`
        }
        return `${pre_return}return ${compile(ast.children[0])}`
        
    }
    
    throw new NotImplementedError(`AST node type "${ast.type}" not implemented`);
}

let ast = new RubyNode('begin', [
    new RubyNode('class', [
        new RubyNode('const', [
            null,
            'Range'
        ]),
        null,
        new RubyNode('begin', [
            new RubyNode('def', [
                'initialize',
                new RubyNode('args', [
                    new RubyNode('arg', ['start']),
                    new RubyNode('arg', ['r_end']),
                    new RubyNode('optarg', [
                        'step',
                        new RubyNode('int', [1])
                    ])
                ]),
                new RubyNode('begin', [
                    new RubyNode('ivasgn', [
                        '@start',
                        new RubyNode('lvar', ['start'])
                    ]),
                    new RubyNode('ivasgn', [
                        '@r_end',
                        new RubyNode('lvar', ['r_end'])
                    ]),
                    new RubyNode('ivasgn', [
                        '@step',
                        new RubyNode('lvar', ['step'])
                    ])
                ])
            ]),
            new RubyNode('def', [
                '[]',
                new RubyNode('args', [new RubyNode('arg', ['i'])]),
                new RubyNode('begin', [
                    new RubyNode('lvasgn', [
                        'x',
                        new RubyNode('send', [
                            new RubyNode('ivar', ['@start']),
                            '+',
                            new RubyNode('send', [
                                new RubyNode('lvar', ['i']),
                                '*',
                                new RubyNode('ivar', ['@step'])
                            ])
                        ])
                    ]),
                    new RubyNode('if', [
                        new RubyNode('send', [
                            new RubyNode('lvar', ['x']),
                            '<',
                            new RubyNode('ivar', ['@r_end'])
                        ]),
                        new RubyNode('return', [new RubyNode('lvar', ['x'])]),
                        null
                    ]),
                    new RubyNode('send', [
                        null,
                        'raise',
                        new RubyNode('send', [
                            new RubyNode('const', [
                                null,
                                'IndexError'
                            ]),
                            'new',
                            new RubyNode('str', ['Index out of range'])
                        ])
                    ])
                ])
            ]),
            new RubyNode('def', [
                'each',
                new RubyNode('args', [new RubyNode('blockarg', ['b'])]),
                new RubyNode('begin', [
                    new RubyNode('lvasgn', [
                        'x',
                        new RubyNode('ivar', ['@start'])
                    ]),
                    new RubyNode('while', [
                        new RubyNode('send', [
                            new RubyNode('lvar', ['x']),
                            '<',
                            new RubyNode('ivar', ['@r_end'])
                        ]),
                        new RubyNode('begin', [
                            new RubyNode('send', [
                                new RubyNode('lvar', ['b']),
                                'call',
                                new RubyNode('lvar', ['x'])
                            ]),
                            new RubyNode('op_asgn', [
                                new RubyNode('lvasgn', ['x']),
                                '+',
                                new RubyNode('ivar', ['@step'])
                            ])
                        ])
                    ])
                ])
            ])
        ])
    ]),
    new RubyNode('lvasgn', [
        'r',
        new RubyNode('send', [
            new RubyNode('const', [
                null,
                'Range'
            ]),
            'new',
            new RubyNode('int', [-100]),
            new RubyNode('int', [100]),
            new RubyNode('int', [3])
        ])
    ]),
    new RubyNode('block', [
        new RubyNode('send', [
            new RubyNode('lvar', ['r']),
            'each'
        ]),
        new RubyNode('args', [new RubyNode('procarg0', [new RubyNode('arg', ['n'])])]),
        new RubyNode('begin', [
            new RubyNode('if', [
                new RubyNode('send', [
                    new RubyNode('lvar', ['n']),
                    '<',
                    new RubyNode('int', [-40])
                ]),
                new RubyNode('next'),
                null
            ]),
            new RubyNode('if', [
                new RubyNode('send', [
                    new RubyNode('lvar', ['n']),
                    '>',
                    new RubyNode('int', [40])
                ]),
                new RubyNode('next'),
                null
            ]),
            new RubyNode('send', [
                null,
                'puts',
                new RubyNode('lvar', ['n'])
            ])
        ])
    ])
]);

let locals = [{
    gets: function(env) { 
        return StringObject.methods("new")(env, prompt("gets"));
    },
    puts: function(env, ...args) {
        // console.trace();
        for (let arg of args) {
            console.log(arg.methods("to_s")(env).s);
        }
    }
}];
let globals = {
    stdout: {
        methods: {
            gets: function(env) { 
                return StringObject.methods("new")(env, prompt("gets"));
            },
            puts: function(env, ...args) {
                for (let arg of args) {
                    console.log(arg.methods("to_s")(env).s);
                }
            }
        }
    }
};

let env = new RubyEnviroment(locals, globals, null);
env.push_empty_object();
env.object_stack[0].consts = {
    STDOUT: function(env) {
        return {
            methods: function(name) {
                return ({
                    gets: function(env) { 
                        return StringObject.methods("new")(env, prompt("gets"));
                    },
                    puts: function(env, ...args) {
                        for (let arg of args) {
                            console.log(arg.methods("to_s")(env).s);
                        }
                    }
                })[name];
            }
        }
    },
    Array: function() { return ArrayClass },
    String: function() { return StringClass },
    Integer: function() { return IntegerClass },
    Object: function() { return ObjectClass },
    BasicObject: function() { return BaseClass },
    // TODO: Class
};
console.log(compile(ast));
var f = ast_to_function(ast);
f(env);