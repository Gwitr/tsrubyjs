import * as tsr from './tsruby.js';
import { ast } from './ast.js'

let output = null;

let locals = [{
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
    }
}];
let globals = {
    stdout: {
        methods: {
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
                        if (output === null) {
                            output = document.getElementById("output");
                        }
                        let s = "";
                        for (let arg of args) {
                            s += arg.methods("to_s")(env).s + "\n";
                        }
                        output.value = output.value + s;
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
