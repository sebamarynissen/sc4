import path from 'node:path';
import { createRequire } from 'node:module';
import core from '@actions/core';

const require = createRequire(path.join(process.env.GITHUB_WORKSPACE, './package.json'));
const pkg = require('./package.json');
console.log(pkg.version);

core.setOutput('version', `v${pkg.version}`);
