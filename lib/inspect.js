// # inspect.js
// Exports the custom inspect symbol so that we can customize loggin in 
// Node.js. We centralize this here so that we can mock this out in the 
// browser bundle.
const util = require('util');
module.exports = util.inspect.custom;
