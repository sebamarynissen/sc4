// # fs.js
// We want to avoid import from node:fs in the core because we might be running 
// in the browser as well. That's where process.getBuiltinModule comes to the 
// rescue.
function resolve() {
	if (globalThis.process?.getBuiltinModule) {
		return globalThis.process.getBuiltinModule('fs');
	} else {
		return null;
	}
}
export default resolve();
