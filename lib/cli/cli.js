#!/usr/bin/env node
import './version-check.js';
import setup from './setup-cli.js';
const program = setup();
program.parse(process.argv);

// Display help by default.
if (program.args.length === 0) {
	program.help();
}
