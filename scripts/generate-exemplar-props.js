// # generate-exemplar-props.js
// See #12. We no longer want to parse all the exemplar props every time we're 
// loading the library because we can't read from disk when running in the 
// browser. From now on we use a single-use build script - this file - and then 
// just read in the result json.
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const file = path.resolve(__dirname, '../data/new_properties.xml');

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
const out = path.resolve(__dirname, '../data/new-properties.json');
fs.writeFileSync(out, JSON.stringify(props));
