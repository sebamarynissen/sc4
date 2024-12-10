// # exemplar-props.ts
// Contains a list of named exemplar properties. Mainly used for debugging, 
// when serializing we just use the number obiously.
// See #12. We no longer parse the xml file at runtime. It's done in a 
// compilation step instad! As such we don't have to access the filesystem!
import props from './data/new-properties.js';
for (let [key, value] of Object.entries(props)) {
	props[value as string] = key;
}
export default props;
