#!/usr/bin/env node
import './version-check.js';
import setup from './setup-cli.js';
const program = setup();
program.parse(process.argv);
