// # register-file-types.js
const { FileType } = require('./enums');
const Exemplar = require('./exemplar.js');
const Lot = require('./lot.js');
const Building = require('./building.js');
const Prop = require('./prop.js');
const Flora = require('./flora.js');
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
const {
	SimGridFloat32,
	SimGridUint32,
	SimGridSint16,
	SimGridUint16,
	SimGridSint8,
	SimGridUint8,
} = require('./sim-grid-file.js');

module.exports = {

	// General filetypes.
	[FileType.Exemplar]: Exemplar,
	[FileType.Cohort]: Exemplar,

	// File types only found in SaveGames. Array file types should be an array 
	// with a single element in it, being the actual constructor. This is how 
	// the dbpf file knows how to parse and serialize these files.
	[FileType.LotFile]: Array(Lot),
	[FileType.BuildingFile]: Array(Building),
	[FileType.PropFile]: Array(Prop),
	[FileType.FloraFile]: Array(Flora),

	[FileType.BaseTextureFile]: Array(BaseTexture),
	[FileType.NetworkFile]: Array(Network),
	[FileType.PrebuiltNetwork]: Array(PrebuiltNetwork),
	[FileType.LineItem]: Array(LineItem),
	[FileType.DepartmentBudget]: Array(DepartmentBudget),
	[FileType.PipeFile]: Array(Pipe),

	[FileType.NetworkIndex]: NetworkIndex,
	[FileType.ItemIndexFile]: ItemIndex,
	[FileType.RegionViewFile]: RegionView,
	[FileType.ZoneDeveloperFile]: ZoneDeveloper,
	[FileType.LotDeveloperFile]: LotDeveloper,
	[FileType.COMSerializerFile]: COMSerializer,
	[FileType.ZoneManager]: ZoneManager,
	[FileType.TractDeveloper]: TractDeveloper,
	[FileType.PlumbingSimulator]: PlumbingSimulator,
	[FileType.TerrainMap]: TerrainMap,

	// Register the different sim grids. We use the same class for multiple type 
	// ids, so we need to register under id manually.
	[FileType.SimGridFloat32]: Array(SimGridFloat32),
	[FileType.SimGridUint32]: Array(SimGridUint32),
	[FileType.SimGridSint16]: Array(SimGridSint16),
	[FileType.SimGridUint16]: Array(SimGridUint16),
	[FileType.SimGridSint8]: Array(SimGridSint8),
	[FileType.SimGridUint8]: Array(SimGridUint8),

};
