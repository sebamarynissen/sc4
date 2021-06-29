// # file-types.js
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

	Exemplar: 0x6534284A,
	Cohort: 0x05342861,
	DIR: 0xE86B1EEF, 
	PNG: 0x856DDBAC,

	// Savegame-specific files.
	LotFile: 0xC9BD5D4A,
	BuildingFile: 0xa9bd882d,
	PropFile: 0x2977AA47,
	FloraFile: 0xa9c05c85,
	BaseTextureFile: 0xc97f987c,
	OccupantFile: 0xa9bc9ab6,
	ItemIndexFile: 0x098F964D,
	RegionViewFile: 0xCA027EDB,
	ZoneDeveloperFile: 0x498f9b01,
	LotDeveloperFile: 0xa990bfe0,
	PropDeveloperFile: 0x89c48f47,
	COMSerializerFile: 0x499b23fe,
	NetworkFile: 0xc9c05c6e,
	TractDeveloper: 0x2990c142,
	LineItem: 0xaa313c9f,
	DepartmentBudget: 0xe990bffc,

	// Sim grids
	SimGridFloat32: 0x49b9e60a,
	SimGridUint32: 0x49b9e606,
	SimGridSint16: 0x49b9e605,
	SimGridUint16: 0x49b9e604,
	SimGridSint8: 0x49b9e603,
	SimGridUint8: 0x49b9e602,

};

// Make them inversely available as well. Note that we risk overwriting 
// duplicates, but that's ok.
for (let key in TYPES) {
	let value = TYPES[key];
	TYPES[value] = key;
}