// # inspect.js
// Exports the custom inspect symbol so that we can customize logging in 
// Node.js.
module.exports = Symbol.for('nodejs.util.inspect.custom');
