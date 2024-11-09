import { createRequire } from 'node:module';
import core from '@actions/core';

const require = createRequire(process.env.GITHUB_WORKSPACE);
const pkg = require('./package.json');
console.log(pkg.version);

core.setOutput('version', `v${pkg.version}`);
