import { BaseClass, Module } from './object.js';
import * as exc from './errors.js';

export var kernel = Module.create("Kernel");
kernel.public_imethods = {
    "_halt": function(env) {
        throw new Error("halted");
    }
};