'use strict';
import { RubyNode } from './lib/rubynode.js';
import * as classes from './lib/classes.js';
import { BaseClass, RubyObject, RubyClass, Module } from './lib/object.js';
import * as exc from './lib/errors.js';
import { ast } from './ast.js';

// TODO: Add the boolean types

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

export class RubyEnviroment {
    constructor() {
        this.rlocals = [{}];
        this.rglobals = {};
        this.block = null;
        this.object_stack = [];
        this.nil_singleton = classes.NilClass.methods("new")(this);
        
        this.INTEGER_CACHE = [];

        for (let i = classes.INTEGER_CACHE_MIN; i <= classes.INTEGER_CACHE_MAX; i++) {
            let rint = classes.IntegerClass.methods("new")(this, i);
            this.INTEGER_CACHE.push(rint);
        }
    }

    _T(env, primitive) {
        // console.log(primitive);
        if (typeof primitive === "function") {
            debugger;
        }
        
        if (typeof primitive === "string") {
            return classes.StringClass.methods("new")(env, primitive);

        } else if (typeof primitive === "number") {
            try {
                return classes.int_js2ruby(env, primitive);
            } catch (e) {
                if (e instanceof RangeError) {
                    return classes.FloatClass.methods("new")(env, primitive);
                }
                throw e;
            }

        } else if (primitive === null) {
            return env.nil_singleton;

        } else if (primitive === undefined) {
            return env.nil_singleton;

        } else if (primitive instanceof Array) {
            return classes.ArrayClass.methods("new")(env, primitive);

        } else if (primitive instanceof RubyObject) {
            return primitive;

        } else {
            throw new exc.NotImplementedError(`lazy af, didn't implement primitive '${typeof primitive}' yet`)
        }
    }

    rset(array, name, value) {
        if (value instanceof Function) {
            array[name] = value;
        } else {
            array[name] = function(env) {return value};
        }
    }

    push_empty_object(name="main") {
        let obj = classes.ObjectClass.methods("new")(this);
        obj.name = name;
        this.object_stack.push(obj);
    }
    
    load_default_constants() {
        this.object_stack[this.object_stack.length - 1].consts = {
            ...this.object_stack[this.object_stack.length - 1].consts,
            STDOUT: function(env) {
                return {
                    methods: function(name) {
                        return ({
                            gets: function(env) {
                                return StringObject.methods("new")(env, prompt("gets"));
                            },
                            puts: function(env, ...args) {
                                if (output === null) {
                                    output = document.getElementById("output");
                                }
                                let s = "";
                                for (let arg of args) {
                                    s += arg.methods("to_s")(env).s + "\n";
                                }
                                output.value = output.value + s;
                                output.scrollTop = output.scrollHeight;
                            }
                        })[name];
                    }
                }
            },
            Array:       function() { return classes.ArrayClass },
            String:      function() { return classes.StringClass },
            Integer:     function() { return classes.IntegerClass },
            Object:      function() { return classes.ObjectClass },
            BasicObject: function() { return classes.BaseClass },
            Symbol:      function() { return classes.SymbolClass },
            Range:       function() { return classes.RangeClass },
            Hash:        function() { return classes.HashClass },
            
            Time: function() {
                return {
                    methods: function(name) {
                        return ({
                            now: function(env) { return classes.FloatClass.methods("new")(env, Date.now() / 1000) }
                        })[name];
                    }
                }
            }
        }
    }
    
    load_default_globals() {
        // ...
    }

    getconst(name) {
        for (let i = this.object_stack.length - 1; i >= 0; i--) {
            let const_f = this.object_stack[i].consts[name];
            if (const_f !== undefined)
                return const_f;
        }
        let ename;
        if (this.object_stack.length > 1) {
            let tlo = this.object_stack[this.object_stack.length - 1];
            if (tlo instanceof RubyClass) {
                ename = tlo.methods("class")(this).name + "::";
            } else {
                ename = tlo.name + "::";
            }
        } else {
            ename = "";
        }
        throw new exc.RubyNameError("Uninitialized constant " + ename + name);
    }

    setconst(name, value) {
        let consts = this.object_stack[this.object_stack.length - 1].consts;
        if (consts[name] !== undefined) {
            // TODO: Throw warning instead of error
            throw new exc.RubyNameError("Constant " + name + " already initialized.");
        }
        if (value instanceof Function)
            consts[name] = value;
        else
            consts[name] = function(env) { return value };
    }
    
    sendlvar(name, ...args) {
        if (this.rlocals[0].hasOwnProperty(name)) {
            return this.rlocals[0][name](this, ...args);
        }
        try {
            return this.object_stack[this.object_stack.length - 1].methods(name)(this, ...args);
        } catch (e) {
            if (e instanceof exc.NoMethodError) {
                let typename = "Object";
                let obj = this.object_stack[this.object_stack.length - 1];
                if (obj.type === Module) {
                    typename = "Module";
                } else if (obj instanceof RubyClass) {
                    typename = "Class";
                }
                throw new exc.RubyNameError('undefined local variable or method `' + name + "' for " + obj.name + ":" + typename);
            }
            throw e;
        }
    }
    
    getivar(name) {
        let ivars = this.object_stack[this.object_stack.length - 1].ivars;
        if (!ivars.hasOwnProperty(name)) {
            return this._T(this, null);
        }
        return ivars[name];
    }

    setivar(name, value) {
        let ivars = this.object_stack[this.object_stack.length - 1].ivars;
        ivars[name] = value;
    }

    augment_class(container, name, base, f) {
        return this._augment_function_container("subclass", container, name, base, f);
    }
    
    augment_module(container, name, f) {
        return this._augment_function_container("create", container, name, Module, f);
    }

    ignoreIfBreak(e) {
        if (!(e instanceof exc.BreakTrigger)) {
            throw e;
        }
    }
    
    breakBlock() {
        throw new exc.BreakTrigger();
    }

    _augment_function_container(cmethod, container, name, base, f) {
        if (base === null) {
            base = BaseClass;
        }
        let rclass;
        if (container.hasOwnProperty(name)) {
            rclass = container[name](this);
        } else {
            rclass = base[cmethod](name);
        }
        // This might be incorrect
        container[name] = function() { return rclass };
        this.object_stack.push(rclass);
        let class_locals = f(this);
        this.object_stack.pop();
        for (let obj_getter_name in class_locals) {
            if (obj_getter_name in this.rlocals[0])
                continue;
            let obj_getter = class_locals[obj_getter_name];

            if (!rclass.has_method(obj_getter_name)) {
                if (obj_getter.defined_in_ruby !== undefined) {
                    rclass.public_imethods[obj_getter_name] = obj_getter;
                }
            }
        }
    }

    create_block(f) {
        return classes.BlockClass.methods("new")(this, f);
    }

    throw_next(value) {
        throw new exc.NextTrigger(value);
    }
}

var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
export function ast_to_function(ast, make_async=false) {
    let code = `
    'use strict';
    let tmpblock = null;
    let tmpblockres = null;
    ${compile(ast).replaceAll("\n", "\n    ")}`;
    if (make_async) {
        return new AsyncFunction("env", code);
    }
    return new Function("env", code);
}

let tab = {
    send: function(ast) {
        let args = [];
        for (let arg of ast.children.slice(2)) {
            args.push(compile(arg));
        }
        let name = JSON.stringify(String(ast.children[1]));
        if (ast.children[0] === null) {
            return `env.sendlvar(${name}, ${args.join(', ')})`;
        }
        let object_expr = compile(ast.children[0]);
        return `${object_expr}.methods(${name})(env, ${args.join(', ')})`;
    },
    begin: function(ast) {
        let res = "(function() {\n    let res;\n";
        for (let expr of ast.children) {
            let c = compile(expr).replaceAll("\n", "\n    ");
            if (c.substr(0, 6) === "return") {
                res += c + ";\n";
            } else {
                res += "    res = " + c + ";\n";
            }
        }
        res += "    return res;\n})()";
        return res;
    },
    kwbegin: function(ast) {
        // no difference from `begin' node
        return tab.begin(ast);
    },
    str: function(ast) {
        return "env._T(env, " + JSON.stringify(String(ast.children[0])) + ")";
    },
    lvasgn: function(ast) {
        let name = JSON.stringify(String(ast.children[0]));
        let expr = compile(ast.children[1]);
        return `env.rset(env.rlocals[0], ${name}, ${expr})`;
    },
    lvar: function(ast) {
        let name = JSON.stringify(String(ast.children[0]));
        return `env.rlocals[0][${name}]()`;
    },
    "while": function(ast) {
        let block = compile(new RubyNode("begin", ast.children.slice(1))).replaceAll("\n", "\n                ");
        let condition = compile(ast.children[0]);
        return `(function() {
    let res;
    while (${condition}) {
        res = (function() {
            ${block}
        })();
    }
    return res;
})()`;
    },
    while_post: function(ast) {
        let block = compile(new RubyNode("begin", ast.children.slice(1))).replaceAll("\n", "\n                ");
        let condition = compile(ast.children[0]);
        return `(function() {
    let res;
    do {
        res = (function() {
            ${block}
        })();
    } while (${condition});
    return res;
})()`;
    },
    "const": function(ast) {
        let name = JSON.stringify(String(ast.children[1]));
        if (ast.children[0] === null) {
            return `env.getconst(${name})(env)`
        }
        let objexpr = compile(ast.children[0]);
        return `${objexpr}.consts[${name}](env)`

    },
    ivasgn: function(ast) {
        let name = JSON.stringify(String(ast.children[0]).substr(1));
        let expr = compile(ast.children[1]);
        return `env.setivar(${name}, ${expr})`
    },
    ivar: function(ast) {
        let name = JSON.stringify(String(ast.children[0]).substr(1));
        return `env.getivar(${name})`;
    },
    casgn: function(ast) {
        let name = JSON.stringify(String(ast.children[1]));
        let expr = compile(ast.children[2]);
        if (ast.children[0] === null) {
            return `env.setconst(${name}, ${expr})`
        }
        let objexpr = compile(ast.children[0]);
        return `env.rset(${objexpr}.consts, ${name}, ${expr});`
    },
    "if": function(ast) {
        let block;
        let block_else;
        if (ast.children[1] === null) {
            block = "";
        } else {
            block = compile(ast.children[1]).replaceAll("\n", "\n            ")
        }
        if (ast.children[2] === null) {
            block_else = "";
        } else {
            block_else = compile(ast.children[2]).replaceAll("\n", "\n            ");
        }
        let condition = compile(ast.children[0]);

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
    },
    gvasgn: function(ast) {
        let name = JSON.stringify(String(ast.children[0]).substr(1));
        let expr = compile(ast.children[1]);
        return `env.rglobals[${name}] = ${expr}`;
    },
    gvar: function(ast) {
        let name = JSON.stringify(String(ast.children[0]).substr(1));
        return `env.rglobals[${name}]`;
    },
    "int": function(ast) {
        return "env._T(env, " + JSON.stringify(Number(ast.children[0])) + ")";
    },
    def: function(ast, defs_o=null) {
        let name = ast.children[0];

        // Convert the function arguments into code
        let aast = ast.children[1];
        let argname_code = "";
        let argname_list = "";
        let optarg_code = "";
        let blockarg_code = "";
        if (aast.children.length > 0) {
            // TODO: The procarg0 argument should be an array of arguments if more than 1 argument was passed.
            if (aast.children[0].type === "procarg0") {
                aast = aast.children[0];
            }
            let name = ast.children[0];
            for (let node of aast.children) {
                let argname = JSON.stringify(String(node.children[0]));
                if (node.type === "arg") {
                    argname_list += "__arg_" + node.children[0] + ", ";
                    argname_code += `env.rset(env.rlocals[0], ${argname}, env._T(env, __arg_${node.children[0]}));\n`;
                } else if (node.type === "restarg") {
                    argname_list += "...__arg_" + node.children[0] + ", ";
                    argname_code += `env.rset(env.rlocals[0], ${argname}, env._T(env, __arg_${node.children[0]}));\n`;
                } else if (node.type === "blockarg") {
                    blockarg_code = `env.rset(env.rlocals[0], ${argname}, env.block);\n`;
                } else if (node.type === "optarg") {
                    let optarg_value = compile(node.children[1]);
                    argname_list += "__arg_" + node.children[0] + ", ";
                    optarg_code += `env.rset(env.rlocals[0], ${argname}, ${optarg_value});
if (__arg_${node.children[0]} !== undefined)
    env.rset(env.rlocals[0], ${argname}, env._T(env, __arg_${node.children[0]}));
`;
                } else {
                    throw new exc.NotImplementedError(`Unknown argument type "${node.type}"`);
                }
            }
            argname_list = argname_list.substr(0, argname_list.length - 2);
        }
        blockarg_code = blockarg_code.replaceAll("\n", "\n    ");
        optarg_code = optarg_code.replaceAll("\n", "\n    ");
        argname_code = argname_code.replaceAll("\n", "\n    ");

        let function_code;
        if (ast.children[2] === null) {
            function_code = "return env._T(env, null);";
        } else {
            function_code = compile(ast.children[2]).replaceAll("\n", "\n        ");    
        }
        if (ast.children[2].type === "return") {
            function_code = `(function() {${function_code}})()`;
        }

        // console.log(env, bound_to, ${argname_list});
        if (defs_o === null) {
            return `(function() {
    env.rlocals[0][${JSON.stringify(String(name))}] = function(env, ${argname_list}) {
        let current_name = ${JSON.stringify(String(name))};
        let current_args = [...arguments];
        let tmpblock = null;
        let tmpblockres = null;
        env.rlocals.stack_push({...(env.rlocals[0])});
        ${blockarg_code}${optarg_code}${argname_code}let b_retval = ${function_code};
        env.rlocals.stack_pop();
        return b_retval;
    };
    env.rlocals[0][${JSON.stringify(String(name))}].defined_in_ruby = true;
    return env.rlocals[0][${JSON.stringify(String(name))}];
})()`;
        } else {
            // TODO: Add public / protected / private support
            return `(function() {
    let defs_obj = ${compile(defs_o)};
    defs_obj.public_methods[${JSON.stringify(String(name))}] = function(env, ${argname_list}) {
        let current_name = ${JSON.stringify(String(name))};
        let current_args = [...arguments];
        let tmpblock = null;
        let tmpblockres = null;
        env.rlocals.stack_push({...(env.rlocals[0])});
        ${blockarg_code}${optarg_code}${argname_code}let b_retval = ${function_code};
        env.rlocals.stack_pop();
        return b_retval;
    };
    defs_obj.public_methods[${JSON.stringify(String(name))}].defined_in_ruby = true;
    return defs_obj.public_methods[${JSON.stringify(String(name))}];
})()`;
        }
    },
    defs: function(ast) {
        return tab.def(new RubyNode("def", ast.children.slice(1)), ast.children[0]);
    },
    array: function(ast) {
        if (ast.children === undefined) {
            return "env._T(env, [])";
        }
        let s = [];
        for (let i of ast.children) {
            s.push(compile(i));
        }
        return `env._T(env, [${s.join(', ')}])`;
    },
    block: function(ast) {
        let ast2 = new RubyNode("def", ["f&", ast.children[1], ast.children[2]]);
        let args = [];
        for (let arg of ast.children[0].children.slice(2)) {
            args.push(compile(arg));
        }
        let args_s = args.join(', ');
        let name = JSON.stringify(String(ast.children[0].children[1]));
        let code1 = compile(ast2).replaceAll("\n", "\n        ");
        if (ast.children[0].children[0] === null) {
            return `(function() {
    let res;
    env.block = env.create_block(${code1});
    try {
        res = env.rlocals[0][${name}](env, ${args_s});
    } catch (e) {
        env.ignoreIfBreak(e);
    }
    env.block = env._T(env, null);
    return res;
})()`;
        } else {
            let code2 = compile(ast.children[0].children[0]).replaceAll("\n", "\n    ");
            return `(function() {
    let res;
    env.rset(env.rlocals[0], "&", env.block = env.create_block(${code1}));
    tmpblockres = ${code2};
    env.block = env.rlocals[0]["&"]();
    try {
        res = tmpblockres.methods(${name})(env, ${args_s});
    } catch (e) {
        env.ignoreIfBreak(e);
    }
    env.block = env._T(env, null);
    return res;
})()`;
        }
    },
    op_asgn: function(ast) {
        let getter;
        if (ast.children[0].type === "lvasgn") {
            getter = new RubyNode("send", [null, ast.children[0].children[0]]);
        
        } else if (ast.children[0].type === "gvasgn") {
            getter = new RubyNode("gvar", [ast.children[0].children[0]]);
        
        } else if (ast.children[0].type === "ivasgn") {
            getter = new RubyNode("ivar", [ast.children[0].children[0]]);
        
        } else if (ast.children[0].type === "casgn") {
            getter = new RubyNode("const", [ast.children[0].children[0], ast.children[0].children[1]]);
        
        } else if (ast.children[0].type === "send") {
            getter = new RubyNode("send", [ast.children[0].children[0], ...ast.children[0].children.slice(1)]);
        
        } else if (ast.children[0].type === "indexasgn") {
            getter = new RubyNode("index", [ast.children[0].children[0], ast.children[0].children[1]]);
            
        } else {
            throw new exc.NotImplementedError("op_asgn with " + ast.children[0].type + " as 1st argument");
        }
        
        let ast2 = new RubyNode(ast.children[0].type, [
            ...ast.children[0].children,
            new RubyNode("send", [
                getter,
                ast.children[1],
                ast.children[2]
            ])
        ]);
        return compile(ast2);
    },
    next: function(ast) {
        if (ast.children.length > 0) {
            throw new exc.NotImplementedError("next with args not implemented yet");
        }
        return 'env.throw_next(env._T(env, null));';
    },
    'class': function(ast) {
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
    ${compile(const_obj).replaceAll('\n', '\n    ')}.consts,
    ${const_name},
    ${inh_expr},
    ${objexpr}
)`;
    },
    module: function(ast) {
        // TODO: Implement private and protected
        let objexpr = `(function() {
            let tmpblock = null;
            let tmpblockres = null;
            env.rlocals.stack_push({...(env.rlocals[0])});
            ${compile(ast.children[1])};
            return env.rlocals.stack_pop();
        })`;
                let const_obj = ast.children[0].children[0];
                let const_name = JSON.stringify(String(ast.children[0].children[1]));
                if (const_obj === null)
                    return `env.augment_module(
            env.object_stack[env.object_stack.length - 1].consts,
            ${const_name},
            ${objexpr.replaceAll('\n', '\n    ')}
        )`;
                return `env.augment_module(
            ${compile(const_obj).replaceAll('\n', '\n    ')}.consts,
            ${const_name},
            ${objexpr}
        )`;
    },
    'return': function(ast) {
        if (ast.children.length === 0) {
            return `return`
        }
        return `return ${compile(ast.children[0])}`;
    },
    sym: function(ast) {
        return `env.getconst("Symbol")(env).methods("new")(env, ${JSON.stringify(ast.children[0])})`;
    },
    nil: function(ast) {
        return 'env.nil_singleton';
    },
    "false": function(ast) {
        return 'false';
    },
    "true": function(ast) {
        return 'true';
    },
    hash: function(ast) {
        if (ast.children.length === 0) {
            // throw new exc.NotImplementedError("hash node with more than 0 children");
            return `env.getconst("Hash")(env).methods("new")(env, env._T(env, null))`;
        } else {
            let keycode = "";
            let valuecode = "";
            for (let pair of ast.children) {
                if (pair.type !== "pair") {
                    throw new TypeError("All `hash' node children must be `pair' nodes");
                }
                keycode += compile(pair.children[0]) + ", ";
                valuecode += compile(pair.children[1]) + ", ";
            }
            return `env.getconst("Hash")(env).methods("new")(env, env._T(env, null), [${keycode}], [${valuecode}])`;
        }
    },
    "float": function(ast) {
        return "env._T(env, " + JSON.stringify(Number(ast.children[0])) + ")";
    },
    and: function(ast) {
        return "((" + compile(ast.children[0]) + ").methods('to_b')(env)) & ((" + compile(ast.children[1]) + ").methods('to_b')(env))";
    },
    or: function(ast) {
        return "((" + compile(ast.children[0]) + ").methods('to_b')(env)) | ((" + compile(ast.children[1]) + ").methods('to_b')(env))";
    },
    index: function(ast) {
        return compile(ast.children[0]) + "[" + compile(ast.children[1]) + ".i]";
    },
    indexasgn: function(ast) {
        return compile(ast.children[0]) + "[" + compile(ast.children[1]) + ".i] = " + compile(ast.children[2]);
    },
    dstr: function(ast) {
        let rs = "";
        for (let c of ast.children) {
            rs += "    s += " + compile(c) + ";\n";
        }
        return `function() {
    let s = "";
    ${rs};
    return s;
}`
    },
    regexp: function(ast) {
        // TODO: Return ruby RegExp object
        let rs = "";
        let regopt = "";
        for (let c of ast.children) {
            if (c.type === "regopt") {
                for (let ro of c.children) {
                    if (ro.type != "sym") {
                        throw new NotImplementedError("Don't know how to understand node type `" + ro.type + "' in regopt node");
                    }
                    regopt += ro.children[0];
                }
            } else {
                rs += "    s += " + compile(c) + ";\n";
            }
        }
        return `function() {
    let s = "";
    ${rs};
    return new RegExp(s, ${JSON.stringify(String(regopt))});
}`
    },
    "for": function(ast) {
        if (ast.children[0].type != "lvasgn") {
            throw new exc.NotImplementedError("'for' with 1st child of type different than 'lvasgn' not implemented yet");
        }
        let local_var_name = ast.children[0].children[0];
        return compile(new RubyNode("block", [
            new RubyNode("send", [
                ast.children[1],
                "each"
            ]),
            new RubyNode('args', [
                new RubyNode('arg', [local_var_name])
            ]),
            ast.children[2]
        ]));
    },
    irange: function(ast) {
        return `env.getconst("Range")(env).methods("new")(env, ${JSON.stringify(ast.children[0])}, ${JSON.stringify(ast.children[1])}, true)`;
    },
    erange: function(ast) {
        return `env.getconst("Range")(env).methods("new")(env, ${JSON.stringify(ast.children[0])}, ${JSON.stringify(ast.children[1])}, false)`;
    },
    self: function(ast) {
        return `env.object_stack[env.object_stack.length - 1]`;
    },
    "case": function(ast) {
        // TODO: Use :=== instead of :== method
        let result = `(function() {
    let expr_result = ${compile(ast.children[0])};
    let result = env._T(env, null);
`;
        for (let i = 1; i < ast.children.length - 1; i++) {
            // console.log(i);
            let other = compile(ast.children[i].children[0]);
            // console.log("other done, doing", ast.children[i].children[1]);
            let other2 = compile(ast.children[i].children[1]).replaceAll("\n", "\n        ");
            // console.log("other2 done");
            if (ast.children[i].children[1].type === "return") {
                result += `    if (expr_result.methods("==")(env, ${other})) {
        ${other2};
    } else `
            } else {
                result += `    if (expr_result.methods("==")(env, ${other})) {
        result = ${other2};
    } else `
            }
        }
        if (ast.children[ast.children.length - 1] === null) {
            result += "{}"; 
        } else {
            result += "{\n" + compile(ast.children[ast.children.length - 1]).replaceAll("\n", "\n        ") + "\n}";
        }
        result += `
    return result;
})();`
        return result;
    },
    "super": function(ast) {
        // TODO: Make this work with private / protected instance methods
        let args = [];
        for (let arg of ast.children) {
            args.push(compile(arg));
        }
        return `env.object_stack[env.object_stack.length - 1].get_base().public_imethods[current_name].call(env.object_stack[env.object_stack.length - 1], env, ${args.join(', ')})`;
    },
    "zsuper": function(ast) {
        // TODO: Make this work with private / protected instance methods
        return `env.object_stack[env.object_stack.length - 1].get_base().public_imethods[current_name].call(env.object_stack[env.object_stack.length - 1], env, ...current_args)`;
    },
    masgn: function(ast) {
        if (ast.children[0].type !== "mlhs") {
            throw new NotImplementedError("masgn node with child #0 of different type than mlhs");
        }
        let a = `(function() {
    let container = ${compile(ast.children[1])};\n`;
        let c = 0;
        for (let b of ast.children[0].children) {
            let ruby_node = new RubyNode("_js", [`container.methods('[]')(env, ${c})`]);
            a += "    " + compile(new RubyNode(b.type, b.children.concat(ruby_node))) + "\n";
            c += 1;
        }
        a += "})()";
        return a;
    },
    "break": function(ast) {
        if (ast.children.length > 0) {
            throw new NotImplementedError("break node with children");
        }
        return "env.breakBlock()";
    },
    alias: function(ast) {
        // TODO: Verify if this is correct
        return `(env.rlocals[0][${compile(ast.children[0])}] = ${compile(ast.children[1])})`;
    },
    rescue: function(ast) {
        let try_code = compile(ast.children[0]);
        // (resbody (array (const nil :Exception) (const nil :A)) (lvasgn :bar) (int 1))
        let except_code_list = [];
        for (let i = 1; i < ast.children.length - 1; i++) {
            if (ast.children[i].children[0] === null) {
                except_code_list.push(`if (true) {
    ${compile(ast.children[i].children[2])};
} else `);
            } else {
                except_code_list.push(`if (caughtException.rubyObject.method('is_a?')(env, ${compile(ast.children[i].children[0])})) {
    ${compile(new RubyNode(ast.children[i].children[1].type, [...ast.children[i].children[1].children, new RubyNode("_js", ["caughtException.rubyObject"])]))};
    ${compile(ast.children[i].children[2])};
} else `);
            }
        }
        return `(function() {
    try {
        ${try_code.replaceAll("\n", "\n        ")};
    } catch (caughtException) {
        if (caughtException.rubyObject === undefined) {
            throw caughtException;
        }
        ${except_code_list.join("\n").replaceAll("\n", "\n        ")}{
            throw caughtException;
        }
    }
})()`
    },
    cvasgn: function(ast) {
        return `(env.object_stack[env.object_stack.length-1].methods("class")(env).ivars[${JSON.stringify(String(ast.children[0]))}] = ${compile(ast.children[1])})`;
    },
    cvar: function(ast) {
        return `env.object_stack[env.object_stack.length-1].methods("class")(env).ivars[${JSON.stringify(String(ast.children[0]))}]`;
    },
    cbase: function(ast) {
        return `env.object_stack[0]`;
    },
    nth_ref: function(ast) {
        return `env.rglobals["${ast.children[0]}"]`;
    },
    "yield": function(ast) {
        return `(function() {
    env.raise_if_block_undefd();
    return env.block.methods("call")(env, ${compile(ast.children[0])});
})()`;
    },
    sclass: function(ast) {
        // throw new exc.NotImplementedError();
        
        let children = [];
        for (let c of ast.children[1].children) {
            if (c.type === "def") {
                children.push(new RubyNode("defs", [new RubyNode("self"), ...c.children]));
            } else {
                throw new exc.NotImplementedError("'" + c.type + "' node in 'sclass' node not supported");
            }
        }
        return compile(new RubyNode("class", [
            new RubyNode("const", [new RubyNode("_js", [
                "env.object_stack[env.object_stack.length - 1]"
            ]), "this"]), 
            null, 
            new RubyNode("begin", children)
        ]));
    },
    
    
    
    _js: function(ast) {
        return ast.children[0];
    }
};

// TODO: Add some sort of compiler state object to remove all the redundant anonymous functions in the output
export function compile(ast) {
    if (!tab.hasOwnProperty(ast.type)) {
        console.log(ast);
        throw new exc.NotImplementedError(`AST node type "${ast.type}" not implemented`);
    }
    try {
        return tab[ast.type](ast);
    } catch (e) {
        console.log(ast);
        throw e;
    }
}