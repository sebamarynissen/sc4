// # types.js
"use strict";

// Some type ids for identifying file types. Found on 
// https://community.simtropolis.com/forums/topic/14323-dbpf-format/
// 
// Exemplar TypeID=6534284A
// LD TypeID=6BE74C60
// PNG TypeID=856DDBAC
// Dir TypeID=E86B1EEF
// LText TypeID=2026960B
// FSH TypeID=7AB50E44
// UI/INI/AB/AE TypeID=00000000
// XML TypeID=88777601
// XML TypeID=88777602
// JFIF TypeID=74807101
// JFIF TypeID=74807102
// JFIF TypeID=856DDBAC
// BMP TypeID=66778001
// BMP TypeID=66778002
// S3D TypeID=5AD0E817
// SC4Path TypeID=296678F7
// ATC TypeID=29A5D1EC
// AVP TypeID=09ADCD75
// Effect Dir TypeID=EA5118B0
// LUA TypeID=CA63E2A3
// CURSOR TypeID=AA5C3144
// KEYCFG TypeID=A2E3D533
// RUL TypeID=0A5BCF4B
// Cohort TypeID=05342861
const TYPES = module.exports = {
	0x6534284A: 'EXEMPLAR',
	0xE86B1EEF: 'DIR',
	0x856DDBAC: 'PNG'
};

// Make them inversely available as well. Note that we risk overwriting 
// duplicates, but that's ok.
for (let key in TYPES) {
	let value = TYPES[key];
	TYPES[value] = Number(key);
}