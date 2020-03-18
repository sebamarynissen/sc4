// # city-manager.js
"use strict";
const path = require('path');
const fs = require('fs');
const Savegame = require('./savegame.js');
const Lot = require('./lot.js');
const Building = require('./building.js');
const Prop = require('./prop.js');
const BaseTexture = require('./lot-base-texture.js');
const { FileType } = require('./enums.js');
const SC4 = path.resolve(process.env.HOMEPATH, 'documents/SimCity 4');
const regions = path.join(SC4, 'regions');

// Hex constants to make the code more readable.
const ExemplarType = 0x10;
const Buildings = 0x02;
const OccupantSize = 0x27812810;
const LotConfigurations = 0x10;
const LotResourceKey = 0xea260589;
const LotConfigPropertySize = 0x88edc790;
const LotConfigPropertyZoneTypes = 0x88edc793;
const Wealth = 0x27812832;
const ZoneData = 0x41800000;
const INSET = 0.1;

// # CityManager
// A class for performing operations on a certain city, such as plopping 
// arbitrary lots etc. Have a look at https://sc4devotion.com/forums/
// index.php?topic=5656.0, contains a lot of relevant info.
class CityManager {

	// ## constructor(opts)
	// Sets up the city manager.
	constructor(opts = {}) {
		
		// Pre-initialize the "private" fields that cannot be modified by the 
		// options.
		this.memRefs = null;
		this.$mem = 1;

		// Setup the "public" fields.
		this.dbpf = opts.dbpf || null;
		this.index = opts.index || null;

	}

	// ## setFileIndex(index)
	// Stores the file index to be used for looking up TGI's etc. That's 
	// required if you want to plop lot's etc. because in that case we need to 
	// know where to look for the resources!
	setFileIndex(index) {
		this.index = index;
	}

	// ## load(file)
	// Loads the given savegame into the city manager.
	load(file) {

		let full = path.resolve(regions, file);

		// No extension given? Add .sc4
		let ext = path.extname(full);
		if (ext !== '.sc4') {
			full += '.sc4';
		}

		// Check if the file exists. If it doesn't exist, then try again 
		// with "City - " in front.
		if (!fs.existsSync(full)) {
			let name = path.basename(full);
			let dir = path.dirname(full);
			full = path.join(dir, 'City - '+name);
			if (!fs.existsSync(full)) {
				throw new Error(`City "${file}" could not be found!`);
			}
		}

		// Create the city.
		this.dbpf = new Savegame(fs.readFileSync(full));

		// Index the *initial* mem refs as well. We need to make sure we do 
		// this before creating any new files in the dbpf, otherwise we're 
		// indexing mem refs we might have created ourselves.
		let set = this.memRefs = new Set();
		for (let { mem } of this.dbpf.memRefs()) {
			set.add(mem);
		}

	}

	// ## save(opts)
	// Saves the city to the given file.
	save(opts) {
		return this.dbpf.save(opts);
	}

	// ## mem()
	// Returns an unused memory address. This is useful if we add new stuff to 
	// a city - such as buildings etc. - because we need to make sure that the 
	// memory addresses for every record are unique.
	mem() {

		// Create a new memory reference, but make sure it doesn't exist yet.
		let ref = this.$mem++;
		while (this.memRefs.has(ref)) {
			ref = this.$mem++;
		}
		this.memRefs.add(ref);
		return ref;

	}

	// ## getProperty(file, key)
	// Helper function for getting a property from an exemplar, taking into
	// account the inheritance chain. It's the index that is actually 
	// responsible for this though.
	getProperty(file, key) {
		return this.index.getProperty(file, key);
	}

	// ## getPropertyValue(file, prop)
	// Returns the direct value for the given property.
	getPropertyValue(file, key) {
		return this.index.getPropertyValue(file, key);
	}

	// ## plop(opts)
	// Behold, the mother of all functions. This function allows to plop any 
	// lot anywhere in the city. Note that this function expects a *building* 
	// exemplar, which means it only works for *ploppable* buildings. For 
	// growable buildings the process is different, in that case you have to 
	// use the "grow" method.
	plop(opts = {}) {

		// (1) First of all we need to find the T10 exemplar file with the 
		// information to plop the lot. Most of the time this resides in an 
		// .sc4lot file, but it doesn't have to.
		let { tgi, building } = opts;
		if (!building && tgi) {
			building = this.index.find(tgi);
			if (!building) {
				throw new Error(
					`Exemplar ${ JSON.stringify(tgi) } not found!`,
				);
			}
		}

		// Check what type of exemplar we're dealing with. As explained by 
		// RippleJet, there's a fundamental difference between ploppable and 
		// growable buildings. Apparently ploppable buildings start from a 
		// building exemplar and then we can look up according 
		// LotConfiguration exemplar.
		let file = building.read();
		if (this.getPropertyValue(file, ExemplarType) !== Buildings) {
			throw new Error([
				'The exemplar is not a building exemplar!',
				'The `.plop()` function expects a ploppable building exemplar!'
			].join(' '));
		}

		// Find the lot resource key, which is the IID where we can find the 
		// LotResourceKey & then based on that find the appropriate Building 
		// exemplar. Note that we currently have no other choice than finding 
		// everything with the same instance ID...
		let IID = this.getPropertyValue(file, LotResourceKey);
		let lotExemplar = this.findExemplarOfType(IID, LotConfigurations);

		// Cool, we have both the building & the lot exemplar. Create the lot.
		let lot = this.build({
			lot: lotExemplar,
			building,
			x: opts.x,
			z: opts.z,
			orientation: opts.orientation,
		});

	}

	// ## grow(opts)
	// This method is similar to the `plop()` method, but this time it starts 
	// from a *Lot Configurations* exemplar, not a ploppable building exemplar 
	// - which is how the game does it. From then on the logic is pretty much 
	// the same.
	grow(opts) {

		let { tgi, exemplar } = opts;
		let record = exemplar ? exemplar : this.index.find(tgi);
		if (!record) {
			throw new Error(
				`Exemplar ${ JSON.stringify(tgi) } not found!`,
			);
		}

		// Ensure that the exemplar that was specified.
		let props = record.read();
		if (+props.value(ExemplarType) !== LotConfigurations) {
			throw new Error([
				'The exemplar is not a lot configurations exemplar!',
				'The `.grow()` function expects a lot exemplar!'
			].join(' '));
		}

		// Find the appropriate building exemplar. Note that it's possible 
		// that the building belongs to a family. In that case we'll pick a 
		// random building from the family.
		let IIDs = props.lotObjects.find(({ type }) => type === 0x00).IIDs;
		let IID = rand(IIDs);
		let buildingExemplar = this.findExemplarOfType(IID, 0x02);

		// Now that we have both the building exemplar and as well as the lot 
		// exemplar we can create the lot and insert everything on it into the 
		// city.
		let { x, z, orientation } = opts;
		let lot = this.build({
			building: buildingExemplar,
			lot: record,
			x,
			z,
			orientation,
		});

	}

	// ## build(opts)
	// This method is responsible for inserting all *physical* entities into 
	// the city such as a lot, a building, the props on the lot, the textures 
	// etc. It's not really meant for public use, you should use the `.plop()` 
	// or `.grow()` methods instead. It requires a lot exemplar and a building 
	// exemplar to be specified. It's the `.plop()` and `.grow()` methods that 
	// are responsible for deciding what building will be inserted.
	build(opts) {

		// First of all create the lot record & insert it into the city.
		let {
			lot: lotExemplar,
			building,
			x = 0,
			z = 0,
			orientation = 0,
		} = opts;

		let lot = this.createLot({
			exemplar: lotExemplar,
			building,
			x: opts.x,
			z: opts.z,
			orientation,
		});

		// Loop all objects on the lot such and insert them.
		let { lotObjects } = lotExemplar.read();
		let textures = [];
		for (let lotObject of lotObjects) {
			switch (lotObject.type) {
				case 0x00:
					this.createBuilding({
						lot,
						lotObject,
						exemplar: building,
					});
					break;
				case 0x01:
					this.createProp({
						lot,
						lotObject,
					});
					break;
				case 0x02:

					// Note: We can't handle textures right away because they 
					// need to be put in a *single* BaseTexture entry. As such 
					// we'll simply collect them for now.
					textures.push(lotObject);
					break;
			}
		}

		// Create the textures.
		this.createTexture({
			lot,
			textures,
		});

		// At last return the created lot so that the calling function can 
		// modify the properties such as capcity, zoneWealth, zoneDensity etc.
		return lot;

	}

	// ## zone(opts)
	// The function responsible for creating RCI zones. Note that we **don't** 
	// use the createLot function underneath as that
	zone(opts) {
		let {
			x = 0,
			z = 0,
			width = 1,
			depth = 1,
			orientation = 0,
			zoneType = 0x01,
		} = opts;
		let { dbpf } = this;
		let { lots, zones } = dbpf;

		// Create the lot with the zone.
		let lot = new Lot({
			mem: this.mem(),
			flag1: 0x10,
			yPos: 270,
			minX: x,
			maxX: x+width-1,
			minZ: z,
			maxZ: z+depth-1,
			commuteX: x,
			commuteZ: z,
			width,
			depth,
			orientation,
			zoneType,

			jobCapacities: [{
				demandSourceIndex: 0x00003320,
				capacity: 0,
			}],

		});
		lots.push(lot);

		// Put in the zone developer file & update the Zone View Sim Grid.
		let grid = dbpf.getSimGrid(FileType.SimGridSint8, ZoneData);
		for (let x = lot.minX; x <= lot.maxX; x++) {
			for (let z = lot.minZ; z <= lot.maxZ; z++) {
				grid.set(x, z, zoneType);
				zones.cells[x][z] = {
					mem: lot.mem,
					type: FileType.LotFile,
				};
			}
		}

		// At last update the com serializer.
		let com = dbpf.COMSerializerFile;
		com.set(FileType.LotFile, lots.length);

		// Return the created zone.
		return lot;

	}

	// ## createLot(opts)
	// Creates a new lot object from the given options when plopping a lot.
	createLot(opts) {

		// Read in the size of the lot because we'll still need it.
		let { dbpf } = this;
		let lots = dbpf.lotFile;
		let { exemplar, x, z, building, orientation = 0 } = opts;
		let file = exemplar.read();
		let [width, depth] = this.getPropertyValue(
			file,
			LotConfigPropertySize
		);

		// Determine the zone type.
		let zoneTypes = this.getPropertyValue(
			file,
			LotConfigPropertyZoneTypes,
		);
		let zoneType = zoneTypes[0] || 0x0f;

		// Determine the zoneWealth as well. Note that this is to be taken 
		// **from the building**.
		let buildingFile = building.read();
		let zoneWealth = this.getPropertyValue(buildingFile, Wealth);

		// Cool, we can now create a new lot entry. Note that we will need to 
		// take into account the
		let lot = new Lot({
			mem: this.mem(),
			IID: exemplar.instance,
			buildingIID: building.instance,

			// For now, just put at y = 270. In the future we'll need to read 
			// in the terrain here.
			yPos: 270,
			minX: x,
			maxX: x+(orientation % 2 === 1 ? depth : width)-1,
			minZ: z,
			maxZ: z+(orientation % 2 === 1 ? width : depth)-1,
			commuteX: x,
			commuteZ: z,
			width,
			depth,
			orientation,
			zoneWealth: zoneWealth || 0x00,
			zoneType,

			// Apparently jobCapacities is also required, otherwise CTD! The 
			// capacity is stored I guess in the LotConfig exemplar, or 
			// perhaps in the building exemplar.
			jobCapacities: [{
				demandSourceIndex: 0x00003320,
				capacity: 0,
			}],

		});

		// Push the lot in the lotFile.
		lots.push(lot);

		// Now put the lot in the zone developer file as well. TODO: We should 
		// actually check first and ensure that no building exists yet here!
		let zones = dbpf.zoneDeveloperFile;
		let grid = dbpf.getSimGrid(FileType.SimGridSint8, ZoneData);
		for (let x = lot.minX; x <= lot.maxX; x++) {
			for (let z = lot.minZ; z <= lot.maxZ; z++) {
				zones.cells[x][z] = {
					mem: lot.mem,
					type: FileType.LotFile,
				};
				grid.set(x, z, zoneType);
			}
		}

		// Don't forget to update the COMSerializer to include the updated 
		// length! Otherwise the lot won't show up!
		let com = dbpf.COMSerializerFile;
		com.set(FileType.LotFile, lots.length);

		// Return the lot that we've just created.
		return lot;

	}

	// ## createBuilding(opts)
	// Creates a new building record and inserts it into the savegame.
	createBuilding(opts) {
		let { lot, lotObject, exemplar } = opts;
		let file = exemplar.read();
		let [width, height, depth] = this.getPropertyValue(file, OccupantSize);
		let { orientation, y } = lotObject;

		// Create the building.
		let building = new Building({
			mem: this.mem(),

			// Now use the **rotated** building rectangle and use it to 
			// position the building appropriately.
			...position(lotObject, lot),
			minY: lot.yPos + y,
			maxY: lot.yPos + y + height,
			orientation: (orientation + lot.orientation) % 4,

			// Store the TGI of the building exemplar.
			TID: exemplar.type,
			GID: exemplar.group,
			IID: exemplar.instance,
			IID1: exemplar.instance,

		});
		setTract(building);

		// Put the building in the index at the correct spot.
		let { dbpf } = this;
		this.addToItemIndex(building, FileType.BuildingFile);

		// Push in the file with all buildings.
		let buildings = dbpf.buildingFile;
		buildings.push(building);

		// Add to the lot developer file as well.
		let dev = dbpf.lotDeveloperFile;
		dev.buildings.push({
			mem: building.mem,
			type: FileType.BuildingFile,
		});

		// At last update the COMSerializer file.
		let com = dbpf.COMSerializerFile;
		com.set(FileType.BuildingFile, buildings.length);
		return building;

	}

	// ## createProp(opts)
	// Creates a new prop record in and inserts it into the save game. Takes 
	// into account the position it should take up in a lot.
	createProp({ lot, lotObject }) {

		// Note: in contrast to the building, we don't know yet what prop 
		// we're going to insert if we're dealing with a prop family. As such 
		// we'll check the families first.
		let { OID, IIDs, orientation, y } = lotObject;
		let IID = rand(IIDs);
		let exemplar = this.findExemplarOfType(IID, 0x1e);

		// Missing props? Just ignore them.
		if (!exemplar) {
			return;
		}

		// Get the dimensions of the prop bounding box.
		let file = exemplar.read();
		let [width, height, depth] = this.getPropertyValue(file, OccupantSize);

		// Create the prop & position correctly.
		let prop = new Prop({
			mem: this.mem(),

			...position(lotObject, lot),
			minY: lot.yPos + y,
			maxY: lot.yPos + y + height,
			orientation: (orientation + lot.orientation) % 4,

			// Store the TGI of the prop.
			TID: exemplar.type,
			GID: exemplar.group,
			IID: exemplar.instance,
			IID1: exemplar.instance,
			OID,

			appearance: 5,
			state: 0,

		});
		setTract(prop);

		// Push in the file with all props.
		let { dbpf } = this;
		let { props } = dbpf;
		props.push(prop);

		// Put the prop in the index.
		this.addToItemIndex(prop, FileType.PropFile, lotObject);

		// Update the COM serializer and we're done.
		let com = dbpf.COMSerializerFile;
		com.set(FileType.PropFile, props.length);
		return props;

	}

	// ## createTexture(opts)
	// Creates a texture entry in the BaseTexture file of the city for the 
	// given lot.
	createTexture(opts) {

		// Create a new texture instance and copy some lot properties in it.
		let { lot, textures } = opts;
		let texture = new BaseTexture({
			mem: this.mem(),

			// Apparently the game requires "insets" on the texture - which it 
			// sets to 0.1, which get rounded to Float32's by the way.
			minX: 16*lot.minX + INSET,
			maxX: 16*(lot.maxX+1) - INSET,
			minZ: 16*lot.minZ + INSET,
			maxZ: 16*(lot.maxZ+1) - INSET,

			// TODO: This is only for flat cities, should use terrain queries 
			// later on!
			minY: lot.yPos,
			maxY: lot.yPos + INSET,

		});
		setTract(texture);

		// Add all required textures.
		for (let def of textures) {
			let { orientation, x, z, IID } = def;
			let [xx, zz] = orient([x, z], lot, { bare: true });

			// Note: the orientation is given in **lot** coordinates,
			// but orientation 0 in the city is 2 in the lot, so add 2 to it. 
			// Additionally we'll also need to handle mirroring.
			let mirrored = orientation >= 0x80000000;
			orientation %= 0x80000000;
			orientation = (lot.orientation + orientation) % 4;
			if (mirrored) {
				orientation += 4;
			}

			// Create the texture at last.
			texture.add({
				IID,
				x: lot.minX + Math.floor(xx),
				z: lot.minZ + Math.floor(zz),
				orientation,
			});

		}

		// Cool, now push the base texture in the city & update the 
		// COMSerializer as well.
		let { dbpf } = this;
		dbpf.textures.push(texture);
		let com = dbpf.COMSerializerFile;
		com.set(FileType.BaseTextureFile, dbpf.textures.length);

		// Update the item index as well.
		this.addToItemIndex(texture, FileType.BaseTextureFile);

		// Return the base texture that we've created.
		return texture;

	}

	// ## addToItemIndex(obj, type)
	// Helper function for adding the given object - that exposes the tract 
	// coordinates - to the item index.
	addToItemIndex(obj, type, euh) {
		let { dbpf } = this;
		let index = dbpf.itemIndexFile;
		for (let x = obj.xMinTract; x <= obj.xMaxTract; x++) {
			for (let z = obj.zMinTract; z <= obj.zMaxTract; z++) {
				if (!index[x][z]) {
					console.log(obj, euh.minX, euh.maxX, euh.minZ, euh.maxZ);
				}
				index[x][z].push({
					mem: obj.mem,
					type: type,
				});
			}
		}
	}

	// ## findExemplarOfType(IID, type)
	// Helper function that can find an exemplar with the given instance of 
	// the given type. It will make use of the families we have as well.
	findExemplarOfType(IID, type) {
		let { index } = this;
		let family = index.family(IID);
		const filter = entry => {
			let file = entry.read();
			return index.getPropertyValue(file, 0x10) === type;
		};
		if (family) {
			let exemplars = family.filter(filter);
			return exemplars[ Math.random()*exemplars.length | 0 ];
		} else {
			let exemplars = index
				.findAllTI(FileType.Exemplar, IID)
				.filter(filter);
			return exemplars[ exemplars.length-1 ];
		}
	}

}

module.exports = CityManager;

// ## setTract(obj)
// Helper function for setting the correct "Tract" values in the given object 
// based on its bounding box.
function setTract(obj) {
	const xSize = 16 * 2**obj.xTractSize;
	const zSize = 16 * 2**obj.zTractSize;
	obj.xMinTract = Math.max(64, 64 + Math.floor(obj.minX / xSize));
	obj.xMaxTract = 64 + Math.floor(obj.maxX / xSize);
	obj.zMinTract = Math.max(64, 64 + Math.floor(obj.minZ / zSize));
	obj.zMaxTract = 64 + Math.floor(obj.maxZ / zSize);
}

// ## orient([x, y], lot, opts)
// Helper function for transforming the point [x, y] that is given in 
// **local** lot coordinates into global **city** coordinates. Note that local 
// lot coordinates use an origin in the bottom-left corner of the lot with an 
// y axis that is going up. This means that we'll need to invert properly!
function orient([x, y], lot, opts = {}) {
	let { width, depth } = lot;

	// First of all we need to swap because orientation 0 in the city is "up", 
	// while orientation 0 in the is "down", and that's also how the 
	// coordinates are expressed!
	[x, y] = [width-x, depth-y];

	// Based on the lot orientation, position correctly.
	switch (lot.orientation) {
		case 0x01:
			[x, y] = [depth-y, x];
			break;
		case 0x02:
			[x, y] = [width-x, depth-y];
			break;
		case 0x03:
			[x, y] = [y, width-x];
			break;

	}

	// If we didn't request bare coordinates explicitly, transform to city 
	// coordinates.
	if (opts.bare) {
		return [x, y];
	} else {
		return [
			16*(lot.minX + x),
			16*(lot.minZ + y),
		];
	}

}

// ## position(lotObject, lot)
// Returns the rectangle we need to position the given lotObject on, taken 
// into account it's positioned on the given lot.
function position(lotObject, lot) {
	let { minX, maxX, minZ, maxZ } = lotObject;
	[minX, minZ] = orient([minX, minZ], lot);
	[maxX, maxZ] = orient([maxX, maxZ], lot);
	if (minX > maxX) {
		[minX, maxX] = [maxX, minX];
	}
	if (minZ > maxZ) {
		[minZ, maxZ] = [maxZ, minZ];
	}
	return { minX, maxX, minZ, maxZ };
}

// ## rand(arr)
// Helper function that randomly selects a value from a given array.
function rand(arr) {
	return arr[Math.random()*arr.length | 0];
}
