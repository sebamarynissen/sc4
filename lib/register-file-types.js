// # register-file-types.js
const { FileType } = require('./enums');
const Exemplar = require('./exemplar.js');
const Lot = require('./lot.js');
const Building = require('./building.js');
const Prop = require('./prop.js');
const Flora = require('./flora.js');

module.exports = function register(DBPF) {

	// General filetypes.
	DBPF.register(FileType.Exemplar, Exemplar);
	DBPF.register(FileType.Cohort, Exemplar);

	// File types only found in SaveGames.
	DBPF.register(FileType.LotFile, [Lot]);
	DBPF.register(FileType.BuildingFile, [Building]);
	DBPF.register(FileType.PropFile, [Prop]);
	DBPF.register(FileType.FloraFile, [Flora]);

	DBPF.register(FileType.BaseTextureFile, [require('./lot-base-texture.js')]);
	DBPF.register(FileType.NetworkFile, [require('./network.js')]);
	DBPF.register(FileType.PrebuiltNetwork, [require('./prebuilt-network.js')]);
	DBPF.register(FileType.LineItem, [require('./line-item.js')]);
	DBPF.register(FileType.DepartmentBudget, [require('./department-budget.js')]);
	DBPF.register(FileType.PipeFile, [require('./pipe.js')]);

	DBPF.register(FileType.NetworkIndex, require('./network-index.js'));
	DBPF.register(FileType.ItemIndexFile, require('./item-index'));
	DBPF.register(FileType.RegionViewFile, require('./region-view'));
	DBPF.register(FileType.ZoneDeveloperFile, require('./zone-developer-file'));
	DBPF.register(FileType.LotDeveloperFile, require('./lot-developer-file'));
	DBPF.register(FileType.COMSerializerFile, require('./com-serializer-file'));
	DBPF.register(FileType.ZoneManager, require('./zone-manager.js'));
	DBPF.register(FileType.TractDeveloper, require('./tract-developer.js'));
	DBPF.register(FileType.PlumbingSimulator, require('./plumbing-simulator.js'));

	// Register the different sim grids. We use the same class for multiple type 
	// ids, so we need to register under id manually.
	const SimGridFile = require('./sim-grid-file.js');
	DBPF.register(FileType.SimGridFloat32, SimGridFile);
	DBPF.register(FileType.SimGridUint32, SimGridFile);
	DBPF.register(FileType.SimGridSint16, SimGridFile);
	DBPF.register(FileType.SimGridUint16, SimGridFile);
	DBPF.register(FileType.SimGridSint8, SimGridFile);
	DBPF.register(FileType.SimGridUint8, SimGridFile);

	// Register the terrain as well.
	DBPF.register(FileType.TerrainMap, require('./terrain-map.js'));
};
