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
        this.name = "NoMethodError";
        this.message = message;
    }
}

class RubyEnviroment {
    constructor(rlocals, rconsts, rglobals, block) {
        this.rlocals = rlocals;
        this.rglobals = rglobals;
        this.rconsts = rconsts;
        this.block = block;
        this.nil_singleton = NilClass.methods("new")(this);
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
        }
        
        this.ivars = {};
        
        if (this.type === undefined) {
            this.name = "BasicObject";
        } else {
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
                return this.public_methods[name].call(ctx, env, ...args)
            };
        }
        if ((name in this.protected_methods) && this.allow_protected_access) {
            return (env, ...args) => {
                return this.protected_methods[name].call(ctx, env, ...args)
            };
        }
        if ((name in this.private_methods) && this.allow_private_access) {
            return (env, ...args) => {
                return this.private_methods[name].call(ctx, env, ...args)
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
            res = {...cr[n], ...res};
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
        return this.i > (IntegerClass.methods("new")(env, "new")(other).i);
    },
    "<": function(env, other) {
        return this.i < (IntegerClass.methods("new")(env, "new")(other).i);
    },
    ">=": function(env, other) {
        return this.i >= (IntegerClass.methods("new")(env, "new")(other).i);
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
        // console.log("A FUCKING BLOCK CALL", args)
        return this.block(env, ...args);
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
    return new Function("env", `    'use strict';
    let tmpblock = null;
    let tmpblockres = null;
    ${compile(ast).replaceAll("\n", "\n    ")}`);
}

function compile(ast, pre_return="") {
    if (ast.type === "send") {
        let args = [];
        for (let arg of ast.children.slice(2)) {
            args.push(compile(arg));
        }
        if (ast.children[0] === null) {
            return `env.rlocals[0][${JSON.stringify(String(ast.children[1]))}](env, ${args.join(', ')})`;
        }
        return `${compile(ast.children[0])}.methods(${JSON.stringify(String(ast.children[1]))})(env, ${args.join(', ')})`;
    
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
        return `rset(env.rlocals[0], ${JSON.stringify(String(ast.children[0], pre_return))}, ${compile(ast.children[1], pre_return)})`;
    
    } else if (ast.type === "lvar") {
        return `env.rlocals[0][${JSON.stringify(String(ast.children[0], pre_return))}]()`;
    
    } else if (ast.type === "while") {
        let block = compile(new RubyNode("begin", ast.children.slice(1)), pre_return).replaceAll("\n", "\n                ");
        return `(function() {
    let res;
    while (${compile(ast.children[0], pre_return)}) {
        res = (function() {
            ${block}
        })();
    }
    return res;
})()`;
    
    } else if (ast.type === "const") {
        return `env.rconsts[${JSON.stringify(String(ast.children[1]))}]()`
        
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
        return `(function() {
    let res = null;
    if (${compile(ast.children[0], pre_return)}) {
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
        return `rset(env.rglobals, ${JSON.stringify(String(ast.children[0]).substr(1))}, ${compile(ast.children[1], pre_return)})`;
    
    } else if (ast.type === "gvar") {
        return `env.rglobals[${JSON.stringify(String(ast.children[0]).substr(1))}]()`;
    
    } else if (ast.type === "int") {
        return "_T(env, " + JSON.stringify(Number(ast.children[0])) + ")";
        
    } else if (ast.type === "def") {
        let aast = ast.children[1];
        let argname_code = "";
        let argname_list = "";
        let blockarg_code = "";
        if (aast.children.length > 0) {
            if (aast.children[0].type === "procarg0") {
                aast = aast.children[0];
            }
            let name = ast.children[0];
            for (let node of aast.children) {
                if (node.type === "arg") {
                    argname_list += node.children[0] + ", ";
                    argname_code += `rset(env.rlocals[0], ${JSON.stringify(String(node.children[0]))}, _T(env, ${node.children[0]}));\n  `
                } else if (node.type === "blockarg") {
                    blockarg_code = `rset(env.rlocals[0], ${JSON.stringify(String(node.children[0]))}, env.block);\n  `
                } else {
                    throw new NotImplementedError(`Unknown argument type "${node.type}"`)
                }
            }
            argname_list = argname_list.substr(0, argname_list.length - 2);
        }
        return `env.rlocals[0][${JSON.stringify(String(name))}] = function(env, ${argname_list}) {
    let tmpblock = null;
    let tmpblockres = null;
    env.rlocals.stack_push({...(env.rlocals[0])});
    ${blockarg_code.replaceAll("\n", "\n    ")}${argname_code.replaceAll("\n", "\n    ")}let b_retval = ${compile(ast.children[2], pre_return).replaceAll("\n", "\n    ")};
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
        if (ast.children[0].children[0] === null) {
            return `(function() {
    let res;
    env.block = BlockClass.methods("new")(env, ${compile(ast2, pre_return).replaceAll("\n", "\n    ")});
    res = env.rlocals[0][${JSON.stringify(String(ast.children[0].children[1]))}](env, ${args.join(', ')});
    env.block = _T(env, null);
    return res;
})()`;
        } else {
            return `(function() {
    let res;
    rset(env.rlocals[0], "&", env.block = BlockClass.methods("new")(env, ${compile(ast2, pre_return).replaceAll("\n", "\n        ")}));
    tmpblockres = ${compile(ast.children[0].children[0], pre_return).replaceAll("\n", "\n    ")};
    env.block = env.rlocals[0]["&"]();
    res = tmpblockres.methods(${JSON.stringify(String(ast.children[0].children[1]))})(env, ${args.join(', ')});
    env.block = _T(env, null);
    return res;
})()`;
        }
        
    } else if (ast.type === "return") {
        if (ast.children === null) {
            return `${pre_return}return`
        }
        return `${pre_return}return ${compile(ast.children[0])}`
        
    }
    
    throw new NotImplementedError(`AST node type "${ast.type}" not implemented`);
}

let ast = new RubyNode('lvasgn', [
    'x',
    new RubyNode('block', [
        new RubyNode('send', [
            new RubyNode('const', [
                null,
                'Array'
            ]),
            'new',
            new RubyNode('int', [5])
        ]),
        new RubyNode('args'),
        new RubyNode('int', [1])
    ])
])
/* new RubyNode('begin', [
    new RubyNode('def', [
        'brange',
        new RubyNode('args', [
            new RubyNode('arg', ['start']),
            new RubyNode('arg', ['rend']),
            new RubyNode('arg', ['step']),
            new RubyNode('blockarg', ['block'])
        ]),
        new RubyNode('block', [
            new RubyNode('send', [
                new RubyNode('begin', [new RubyNode('send', [
                        new RubyNode('begin', [new RubyNode('send', [
                                new RubyNode('lvar', ['rend']),
                                '-',
                                new RubyNode('lvar', ['start'])
                            ])]),
                        '/',
                        new RubyNode('lvar', ['step'])
                    ])]),
                'times'
            ]),
            new RubyNode('args', [new RubyNode('procarg0', [new RubyNode('arg', ['i'])])]),
            new RubyNode('send', [
                new RubyNode('lvar', ['block']),
                'call',
                new RubyNode('send', [
                    new RubyNode('send', [
                        new RubyNode('lvar', ['i']),
                        '*',
                        new RubyNode('lvar', ['step'])
                    ]),
                    '+',
                    new RubyNode('lvar', ['start'])
                ])
            ])
        ])
    ]),
    new RubyNode('def', [
        'range',
        new RubyNode('args', [
            new RubyNode('arg', ['start']),
            new RubyNode('arg', ['rend']),
            new RubyNode('arg', ['step'])
        ]),
        new RubyNode('begin', [
            new RubyNode('lvasgn', [
                'result',
                new RubyNode('array')
            ]),
            new RubyNode('block', [
                new RubyNode('send', [
                    new RubyNode('begin', [new RubyNode('send', [
                            new RubyNode('begin', [new RubyNode('send', [
                                    new RubyNode('lvar', ['rend']),
                                    '-',
                                    new RubyNode('lvar', ['start'])
                                ])]),
                            '/',
                            new RubyNode('lvar', ['step'])
                        ])]),
                    'times'
                ]),
                new RubyNode('args', [new RubyNode('procarg0', [new RubyNode('arg', ['i'])])]),
                new RubyNode('send', [
                    new RubyNode('lvar', ['result']),
                    '<<',
                    new RubyNode('begin', [new RubyNode('send', [
                            new RubyNode('send', [
                                new RubyNode('lvar', ['i']),
                                '*',
                                new RubyNode('lvar', ['step'])
                            ]),
                            '+',
                            new RubyNode('lvar', ['start'])
                        ])])
                ])
            ]),
            new RubyNode('return', [new RubyNode('lvar', ['result'])])
        ])
    ]),
    new RubyNode('send', [
        null,
        'puts',
        new RubyNode('str', [' ================= RANGE ================= '])
    ]),
    new RubyNode('lvasgn', [
        'x',
        new RubyNode('send', [
            null,
            'range',
            new RubyNode('int', [-100]),
            new RubyNode('int', [100]),
            new RubyNode('int', [3])
        ])
    ]),
    new RubyNode('block', [
        new RubyNode('send', [
            new RubyNode('lvar', ['x']),
            'each_with_index'
        ]),
        new RubyNode('args', [
            new RubyNode('arg', ['n']),
            new RubyNode('arg', ['i'])
        ]),
        new RubyNode('send', [
            null,
            'puts',
            new RubyNode('send', [
                new RubyNode('send', [
                    new RubyNode('send', [
                        new RubyNode('lvar', ['i']),
                        'to_s'
                    ]),
                    '+',
                    new RubyNode('str', [' '])
                ]),
                '+',
                new RubyNode('send', [
                    new RubyNode('lvar', ['n']),
                    'to_s'
                ])
            ])
        ])
    ]),
    new RubyNode('send', [
        null,
        'puts',
        new RubyNode('str', [' ================= RANGE direct ================= '])
    ]),
    new RubyNode('block', [
        new RubyNode('send', [
            new RubyNode('send', [
                null,
                'range',
                new RubyNode('int', [-100]),
                new RubyNode('int', [100]),
                new RubyNode('int', [3])
            ]),
            'each_with_index'
        ]),
        new RubyNode('args', [
            new RubyNode('arg', ['n']),
            new RubyNode('arg', ['i'])
        ]),
        new RubyNode('send', [
            null,
            'puts',
            new RubyNode('send', [
                new RubyNode('send', [
                    new RubyNode('send', [
                        new RubyNode('lvar', ['i']),
                        'to_s'
                    ]),
                    '+',
                    new RubyNode('str', [' '])
                ]),
                '+',
                new RubyNode('send', [
                    new RubyNode('lvar', ['n']),
                    'to_s'
                ])
            ])
        ])
    ]),
    new RubyNode('send', [
        null,
        'puts',
        new RubyNode('str', [' ================= BRANGE ================= '])
    ]),
    new RubyNode('block', [
        new RubyNode('send', [
            null,
            'brange',
            new RubyNode('int', [-100]),
            new RubyNode('int', [100]),
            new RubyNode('int', [3])
        ]),
        new RubyNode('args', [new RubyNode('procarg0', [new RubyNode('arg', ['n'])])]),
        new RubyNode('send', [
            null,
            'puts',
            new RubyNode('lvar', ['n'])
        ])
    ])
]); */

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
let consts = {
    STDOUT: function() {
        return {
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
    },
    Array: function() { return ArrayClass },
    String: function() { return StringClass },
    Integer: function() { return IntegerClass },
    Object: function() { return ObjectClass },
    BasicObject: function() { return BaseClass },
    // TODO: Class
};
let globals = {
    stdout: function() {
        return {
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
    }
};

let env = new RubyEnviroment(locals, consts, globals, null);
console.log(compile(ast));
var f = ast_to_function(ast);
f(env);