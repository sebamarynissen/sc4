// # register-file-types.js
const { FileType } = require('./enums');
const Exemplar = require('./exemplar.js');
const Lot = require('./lot.js');
const Building = require('./building.js');
const Prop = require('./prop.js');
const Flora = require('./flora.js');
const SimGrid = require('./sim-grid-file.js');
const TerrainMap = require('./terrain-map.js');
const BaseTexture = require('./lot-base-texture.js');
const Network = require('./network.js');
const PrebuiltNetwork = require('./prebuilt-network.js');
const LineItem = require('./line-item.js');
const DepartmentBudget = require('./department-budget.js');
const Pipe = require('./pipe.js');
const NetworkIndex = require('./network-index.js');
const ItemIndex = require('./item-index.js');
const RegionView = require('./region-view.js');
const ZoneDeveloper = require('./zone-developer-file.js');
const LotDeveloper = require('./lot-developer-file.js');
const COMSerializer = require('./com-serializer-file.js');
const ZoneManager = require('./zone-manager.js');
const TractDeveloper = require('./tract-developer.js');
const PlumbingSimulator = require('./plumbing-simulator.js');

module.exports = function register(DBPF) {

	// General filetypes.
	DBPF.register(FileType.Exemplar, Exemplar);
	DBPF.register(FileType.Cohort, Exemplar);

	// File types only found in SaveGames.
	DBPF.register(FileType.LotFile, Array(Lot));
	DBPF.register(FileType.BuildingFile, Array(Building));
	DBPF.register(FileType.PropFile, Array(Prop));
	DBPF.register(FileType.FloraFile, Array(Flora));

	DBPF.register(FileType.BaseTextureFile, Array(BaseTexture));
	DBPF.register(FileType.NetworkFile, Array(Network));
	DBPF.register(FileType.PrebuiltNetwork, Array(PrebuiltNetwork));
	DBPF.register(FileType.LineItem, Array(LineItem));
	DBPF.register(FileType.DepartmentBudget, Array(DepartmentBudget));
	DBPF.register(FileType.PipeFile, Array(Pipe));

	DBPF.register(FileType.NetworkIndex, NetworkIndex);
	DBPF.register(FileType.ItemIndexFile, ItemIndex);
	DBPF.register(FileType.RegionViewFile, RegionView);
	DBPF.register(FileType.ZoneDeveloperFile, ZoneDeveloper);
	DBPF.register(FileType.LotDeveloperFile, LotDeveloper);
	DBPF.register(FileType.COMSerializerFile, COMSerializer);
	DBPF.register(FileType.ZoneManager, ZoneManager);
	DBPF.register(FileType.TractDeveloper, TractDeveloper);
	DBPF.register(FileType.PlumbingSimulator, PlumbingSimulator);

	// Register the different sim grids. We use the same class for multiple type 
	// ids, so we need to register under id manually.
	DBPF.register(FileType.SimGridFloat32, SimGrid);
	DBPF.register(FileType.SimGridUint32, SimGrid);
	DBPF.register(FileType.SimGridSint16, SimGrid);
	DBPF.register(FileType.SimGridUint16, SimGrid);
	DBPF.register(FileType.SimGridSint8, SimGrid);
	DBPF.register(FileType.SimGridUint8, SimGrid);

	// Register the terrain as well.
	DBPF.register(FileType.TerrainMap, TerrainMap);
};
