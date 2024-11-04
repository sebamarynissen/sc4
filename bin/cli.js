#!/usr/bin/env node
require('./version-check.js');
const setup = require('./setup-cli.js');
const program = setup();
program.parse(process.argv);

// Display help by default.
if (program.args.length === 0) {
	program.help();
}
