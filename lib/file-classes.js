// # register-file-types.js
const { Exemplar, Cohort } = require('./exemplar.js');
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

	// General files.
	Exemplar,
	Cohort,

	// File types only found in SaveGames. Array file types should be an array 
	// with a single element in it, being the actual constructor. This is how 
	// the dbpf file knows how to parse and serialize these files.
	Lot,
	Building,
	Prop,
	Flora,
	BaseTexture,
	Network,
	PrebuiltNetwork,
	LineItem,
	DepartmentBudget,
	Pipe,
	NetworkIndex,
	ItemIndex,
	RegionView,
	ZoneDeveloper,
	LotDeveloper,
	COMSerializer,
	ZoneManager,
	TractDeveloper,
	PlumbingSimulator,
	TerrainMap,
	SimGridFloat32,
	SimGridUint32,
	SimGridSint16,
	SimGridUint16,
	SimGridSint8,
	SimGridUint8,

};
