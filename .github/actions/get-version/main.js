import path from 'node:path';
import { createRequire } from 'node:module';
import core from '@actions/core';

// Read in the version from package.json and simply report it as output.
const require = createRequire(path.join(process.env.GITHUB_WORKSPACE, './package.json'));
const pkg = require('./package.json');
core.setOutput('version', `v${pkg.version}`);
