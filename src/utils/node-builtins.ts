// # node-builtins.ts
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
		return {};
	}
}
export const { fs, path, util, sea, crypto, os } = resolve();
