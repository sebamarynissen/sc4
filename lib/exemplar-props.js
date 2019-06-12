// # exemplar-props.js
// Contains a list of named exemplar properties. Mainly used for debugging, 
// when serializing we just use the number obiously.
"use strict";
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const file = path.resolve(__dirname, '../data/new_properties.xml');

// Parse the new_properties.xml file.
let xml;
xml2js.parseString(fs.readFileSync(file), function(err, result) {
	xml = result;
});

// Assign them all;
const props = module.exports = {};
for (let prop of xml.ExemplarProperties.PROPERTIES[0].PROPERTY) {
	let attrs = prop.$;
	let help = String(prop.HELP || '');
	let id = Number(attrs.ID);
	let name = String(attrs.Name);
	props[name] = id;
	props[id] = name;
}