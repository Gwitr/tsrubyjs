import * as tsr from './tsruby.js';
import { ast } from './ast.js';
import * as classes from './lib/classes.js';

import { BaseClass } from './lib/object.js';
import * as exc from './lib/errors.js';
import * as modules from './lib/modules.js';

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
        output.scrollTop = output.scrollHeight;
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
                output.scrollTop = output.scrollHeight;
            }
        }
    }
};

let env = new tsr.RubyEnviroment(locals, globals, null);
env.push_empty_object();
env.load_default_constants();
env.load_default_globals();
env.rlocals[0] = {
    ...env.rlocals[0],
    puts: function(...args) { 
        console.log(args);
        return env.object_stack[0].consts.STDOUT(env).methods("puts")(...args); 
    }
}

//// Begin test code

let A = BaseClass.subclass("A");
A.extend(modules.kernel);
A.public_methods = {
    "test": function() {
        try {
            this.methods("_halt")(env);
            console.log("A: Method lookup not working properly (fell through)");
        } catch (e) {
            if (e.message == "halted") {
                console.log("A: Method lookup working properly");
                return;
            }
            throw e;
        }
    }
};

let B = BaseClass.subclass("B");
B.include(modules.kernel);
B.public_imethods = {
    "test": function() {
        try {
            this.methods("_halt")(env);
            console.log("B: Method lookup not working properly (fell through)");
        } catch (e) {
            if (e.message == "halted") {
                console.log("B: Method lookup working properly");
                return;
            }
            throw e;
        }
    }
};

let C = B.subclass("C");
C.public_imethods = {
    "test2": function() {
        try {
            this.methods("_halt")(env);
            console.log("C: Method lookup not working properly (fell through)");
        } catch (e) {
            if (e.message == "halted") {
                console.log("C: Method lookup working properly");
                return;
            }
            throw e;
        }
    }
};

A.methods("test")(env);
let B_instance = B.methods("new")(env);
B_instance.methods("test")(env);
let C_instance = C.methods("new")(env);
C_instance.methods("test2")(env);

//// End test code

window.env = env;
console.log(tsr.compile(ast));
var f = tsr.ast_to_function(ast);
f(env);
