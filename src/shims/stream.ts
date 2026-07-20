export function Stream() {}

Stream.prototype.on = function on() {
    return this;
};

Stream.prototype.emit = function emit() {
    return false;
};
