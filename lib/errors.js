export class NotImplementedError extends Error {
    constructor(message) {
        super();
        this.name = "NotImplementedError";
        this.message = message;
    }
}

export class NextTrigger extends Error {
    constructor(return_value) {
        super();
        this.name = "Ruby runtime error";
        this.message = "next used outside of block";
        this.return_value = return_value;
    }
}

export class NoType extends Error {
    constructor(message) {
        super();
        this.name = "NoType";
        this.message = message;
    }
}

export class RubyError extends Error {
    constructor(message) {
        super();
        this.name = "[Ruby]";
        this.message = message;
    }
}

export class NoMethodError extends RubyError {
    constructor(message) {
        super();
        this.name = "[Ruby] NoMethodError";
        this.message = message;
    }
}

export class RubyNameError extends RubyError {
    constructor(message) {
        super();
        this.name = "[Ruby] NameError";
        this.message = message;
    }
}
