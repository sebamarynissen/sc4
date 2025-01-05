// # file-types.js
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

// Savegame-specific files. These files are only found in .sc4 files, which are 
// also DBPF files.
export const SavegameFileType = {
	Lot: 0xC9BD5D4A,
	Building: 0xa9bd882d,
	Prop: 0x2977AA47,
	Flora: 0xa9c05c85,
	BaseTexture: 0xc97f987c,
	Occupant: 0xa9bc9ab6,
	Pedestrian: 0x896e75af,
	ItemIndex: 0x098F964D,
	RegionView: 0xCA027EDB,
	ZoneDeveloper: 0x498f9b01,
	LotDeveloper: 0xa990bfe0,
	PropDeveloper: 0x89c48f47,
	COMSerializer: 0x499b23fe,
	Network: 0xc9c05c6e,
	PrebuiltNetwork: 0x49c1a034,
	NetworkBridgeOccupant: 0x49cc1bcd,
	NetworkIndex: 0x6a0f82b2,
	NetworkTunnelOccupant: 0x8a4bd52b,
	NetworkManager: 0xc990bd46,
	TractDeveloper: 0x2990c142,
	LineItem: 0xaa313c9f,
	DepartmentBudget: 0xe990bffc,
	Pipe: 0x49c05b9f,
	PlumbingSimulator: 0x0990c075,
	ZoneManager: 0x298f9b2d,

	// Terrain map is a bit special because it is also identified by group and 
	// instance inside a Savegame, but obviously the type id is still needed 
	// sometimes.
	TerrainMap: 0xa9dd6ff4,
	TerrainBox: 0x8a91e7e3,
	TerrainFlags: 0x8a91e7e0,
	cSTETerrain: 0xe98f9525,
	cSTETerrainView3D: 0xc9b84e10,

} as const;

export const SimGridFileType = {
	SimGridUint8: 0x49b9e602,
	SimGridSint8: 0x49b9e603,
	SimGridUint16: 0x49b9e604,
	SimGridSint16: 0x49b9e605,
	SimGridUint32: 0x49b9e606,
	SimGridFloat32: 0x49b9e60a,
} as const;

// Zip all known file types together now.
export const FileType = {
	Exemplar: 0x6534284A,
	Cohort: 0x05342861,
	DIR: 0xE86B1EEF,
	PNG: 0x856DDBAC,
	LTEXT: 0x2026960b,
	FSH: 0x7ab50e44,
	S3D: 0x5ad0e817,
	XML: 0x88777602,
	AVP: 0x09adcd75,
	ATC: 0x29a5d1ec,
	SC4Path: 0x296678f7,
	KEYCFG: 0xa2e3d533,
	CURSOR: 0xaa5c3144,
	LUA: 0xca63e2a3,
	EffectDir: 0xea5118b0,
	...SimGridFileType,
	...SavegameFileType,

} as const;

// Export them all as the default as well.
export default FileType;
