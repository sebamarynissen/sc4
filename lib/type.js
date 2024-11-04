// # type.js
'use strict';

// # createType(type)
// The function that we actually export. When called it will return a 
// decorated sub-class of "Type" that contains the required type id.
const hType = Symbol.for('sc4.type');
function createType(type) {
	return class {
		static [hType] = type;
	};
}
module.exports = createType;
