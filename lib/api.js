// # api.js
// Contains the JavaScript api of the cli. This separates concerns nicely: the 
// api does the actual job, while the cli is merely responsible for the 
// options parsing.
"use strict";

exports.historical = function(dbpf, opts) {
	console.log(dbpf, opts);
};

// # growify(dbpf, opts)
exports.growify = function(dbpf, opts) {
	console.log(dbpf, opts);
};

exports.DBPF = require('./dbpf');