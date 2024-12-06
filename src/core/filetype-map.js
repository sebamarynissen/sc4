// # filetype-map.js
import * as FileClasses from './file-classes.js';

// # getConstructorByType(type)
export function getConstructorByType(type) {
	return map[type];
}

// # register(Constructor)
// Registers a new FileType to be automatically handled by DBPFs.
export function register(Constructor) {
	map[Constructor[kType]] = Constructor;
}

// # hasConstructorByType(type)
export function hasConstructorByType(type) {
	return Object.hasOwn(map, type);
}

// # getTypeFromInstance(obj)
// Returns the type id from the given object instance.
export function getTypeFromInstance(obj) {
	return obj[kType] || obj.constructor?.[kType];
}

// Dynamically builds up a map that maps each file type to its appropriate 
// constructor. We do this by looping all classes exported from FileClasses and 
// then read their type from the Symbol.for('sc4.type') static property. It's 
// also this list that third party code might add new known file types to decode.
const kType = Symbol.for('sc4.type');
const map = Object.create(null);
for (let Constructor of Object.values(FileClasses)) {
	register(Constructor);
}
