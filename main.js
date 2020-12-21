import * as tsr from './tsruby.js';
import { ast } from './ast.js'


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

let env = new tsr.RubyEnviroment(locals, globals, null);
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
    Array: function() { return tsr.ArrayClass },
    String: function() { return tsr.StringClass },
    Integer: function() { return tsr.IntegerClass },
    Object: function() { return tsr.ObjectClass },
    BasicObject: function() { return tsr.BaseClass },
    // TODO: Class
};
window.env = env;
console.log(tsr.compile(ast));
var f = tsr.ast_to_function(ast);
f(env);
