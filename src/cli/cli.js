#!/usr/bin/env node
import './version-check.js';
import env from './setup-env.js';
import setup from './setup-cli.js';

// Note: we're bundling to cjs with esbuild so we can't use top-level await.
(async () => {
	await env();
	const program = setup();
	program.parse(process.argv);
})();
