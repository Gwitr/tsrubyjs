'use strict';
import { RubyNode } from './lib/rubynode.js';
import * as classes from './lib/classes.js';
import { BaseClass, RubyObject } from './lib/object.js';
import * as exc from './lib/errors.js';

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
    constructor(rlocals, rglobals, block) {
        this.rlocals = rlocals;
        this.rglobals = rglobals;
        this.block = block;
        this.object_stack = [];
        this.nil_singleton = classes.NilClass.methods("new")(this);
    }

    _T(env, primitive) {
        if (typeof primitive === "string") {
            return classes.StringClass.methods("new")(env, primitive);

        } else if (typeof primitive === "number") {
            return classes.IntegerClass.methods("new")(env, primitive);

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

    getconst(name) {
        for (let i = this.object_stack.length - 1; i >= 0; i--) {
            let const_f = this.object_stack[i].consts[name];
            if (const_f !== undefined)
                return const_f;
        }
        throw new exc.RubyNameError("Uninitialized constant " + name);
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

    getivar(name) {
        for (let i = this.object_stack.length - 1; i >= 0; i--) {
            let ivar = this.object_stack[i].ivars[name];
            if (ivar !== undefined)
                return ivar;
        }
        return env._T(this, null);
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

    create_block(f) {
        return classes.BlockClass.methods("new")(this, f);
    }

    throw_next(value) {
        throw new exc.NextTrigger(value);
    }
}

export function ast_to_function(ast) {
    return new Function("env", `
    'use strict';
    let tmpblock = null;
    let tmpblockres = null;
    ${compile(ast).replaceAll("\n", "\n    ")}`);
}

export function compile(ast, pre_return="") {
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
        return "env._T(env, " + JSON.stringify(String(ast.children[0])) + ")";

    } else if (ast.type === "lvasgn") {
        let name = JSON.stringify(String(ast.children[0]));
        let expr = compile(ast.children[1], pre_return);
        return `env.rset(env.rlocals[0], ${name}, ${expr})`;

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
        return `env.rset(${objexpr}.consts, ${name}, ${expr});`

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
        return "env._T(env, " + JSON.stringify(Number(ast.children[0])) + ")";

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
                    argname_code += `env.rset(env.rlocals[0], ${argname}, env._T(env, __arg_${node.children[0]}));\n`;
                } else if (node.type === "blockarg") {
                    blockarg_code = `env.rset(env.rlocals[0], ${argname}, env.block);\n`;
                } else if (node.type === "optarg") {
                    let optarg_value = compile(node.children[1], pre_return);
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
            return "env._T(env, [])";
        }
        let s = [];
        for (let i of ast.children) {
            s.push(compile(i, pre_return));
        }
        return `env._T(env, [${s.join(', ')}])`;

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
    env.block = env.create_block(${code1});
    res = env.rlocals[0][${name}](env, ${args_s});
    env.block = env._T(env, null);
    return res;
})()`;
        } else {
            let code2 = compile(ast.children[0].children[0], pre_return).replaceAll("\n", "\n    ");
            return `(function() {
    let res;
    env.rset(env.rlocals[0], "&", env.block = env.create_block(${code1}));
    tmpblockres = ${code2};
    env.block = env.rlocals[0]["&"]();
    res = tmpblockres.methods(${name})(env, ${args_s});
    env.block = env._T(env, null);
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
            throw new exc.NotImplementedError("next with args not implemented yet");
        }
        return 'env.throw_next(env._T(env, null));';

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

    throw new exc.NotImplementedError(`AST node type "${ast.type}" not implemented`);
}
