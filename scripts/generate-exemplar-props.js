// # generate-exemplar-props.js
// See #12. We no longer want to parse all the exemplar props every time we're 
// loading the library because we can't read from disk when running in the 
// browser. From now on we use a single-use build script - this file - and then 
// just read in the result json.
import path from 'node:path';
import fs from 'node:fs';
import xml2js from 'xml2js';
const file = path.resolve(import.meta.dirname, '../lib/core/data/new_properties.xml');

// Parse the new_properties.xml file
let xml;
xml2js.parseString(fs.readFileSync(file), (err, result) => {
	xml = result;
});

// Assig them all. Note that we will no longer invert the properties, that's 
// something of which the runtime is still responsible! This shaves off some 
// unnecessary kbs when shipping in the browser.
const props = {};
for (let prop of xml.ExemplarProperties.PROPERTIES[0].PROPERTY) {
	let attrs = prop.$;
	let help = String(prop.HELP || '');
	let id = Number(attrs.ID);
	let name = String(attrs.Name);
	props[name] = id;
}

// Now write away as a json file.
const out = path.resolve(import.meta.dirname, '../lib/core/data/new-properties.js');
const contents = `// eslint-disable-next-line quotes
export default JSON.parse(${JSON.stringify(JSON.stringify(props))})
`;
fs.writeFileSync(out, contents);
