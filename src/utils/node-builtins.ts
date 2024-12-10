// # node-builtins.ts
import type Fs from 'node:fs';
import type Path from 'node:path';
import type Util from 'node:util';
import type Sea from 'node:sea';
import type Crypto from 'node:crypto';
import type Os from 'node:os';

// We want to avoid importing builtin node modules becuase we might be running 
// in the browser as well. That's where process.getBuiltinModule comes to the 
// rescue. This allows us to avoid importing those modules, and conditionally 
// require them instead.
function resolve() {
	if ('process' in globalThis && 'getBuiltinModule' in globalThis.process) {
		const { getBuiltinModule } = globalThis.process;
		return {
			fs: getBuiltinModule('fs'),
			path: getBuiltinModule('path'),
			util: getBuiltinModule('util'),
			sea: getBuiltinModule('sea'),
			crypto: getBuiltinModule('crypto'),
			os: getBuiltinModule('os'),
		};
	} else {

		// Avoid TypeScript complaining that the modules might be undefined. We 
		// know that's possible.
		return {
			fs: {} as unknown as typeof Fs,
			path: {} as unknown as typeof Path,
			util: {} as unknown as typeof Util,
			sea: {} as unknown as typeof Sea,
			crypto: {} as unknown as typeof Crypto,
			os: {} as unknown as typeof Os,
		};

	}
}
export const { fs, path, util, sea, crypto, os } = resolve();
