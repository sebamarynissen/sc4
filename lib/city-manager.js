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

		// If we didn't set up the memory references yet, parse them.
		if (!this.memRefs) {
			let { dbpf } = this;
			let set = this.memRefs = new Set();
			for (let { mem } of dbpf.memRefs()) {
				set.add(mem);
			}
		}

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
		let IID = props.lotObjects.find(({ type }) => type === 0x00).IID;
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
			building: building.instance,
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

		// Cool, we can now create a new lot entry. Note that we will need to 
		// take into account the
		let lot = new Lot({
			mem: this.mem(),
			IID: building,
			buildingIID: building,
			zoneType: 0x0f,

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

			// Important! ZoneWealth cannot be set to 0, otherwise CTD!
			zoneWealth: 0x03,

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
		for (let x = lot.minX; x <= lot.maxX; x++) {
			for (let z = lot.minZ; z <= lot.maxZ; z++) {
				zones.cells[x][z] = {
					mem: lot.mem,
					type: FileType.LotFile,
				};
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
		let { orientation, x, y, z } = lotObject;

		// Find the rectangle the building is occupying on the lot, where the 
		// origin of the coordinate system is in the top-left corner. Note 
		// that we already rotate the building into place **in the lot**. We 
		// still need to rotate the building rectangle later on based on the 
		// orientation of the lot *itself*.
		if (orientation % 2 === 1) {
			[width, depth] = [depth, width];
		}
		let rect = position({
			minX: 16*x - width/2,
			maxX: 16*x + width/2,
			minZ: 16*z - depth/2,
			maxZ: 16*z + depth/2,
		}, lot);

		// Create the building.
		let building = new Building({
			mem: this.mem(),

			// Now use the **rotated** building rectangle and use it to 
			// position the building appropriately.
			...rect,
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
		let { IID, orientation, x, y, z } = lotObject;
		let exemplar = this.findExemplarOfType(IID, 0x1e);
		if (!exemplar) {
			// console.warn(`Missing prop ${ IID }!`);
			return;
		}
		let file = exemplar.read();
		let [width, height, depth] = this.getPropertyValue(file, OccupantSize);

		// Find the rectangle the prop is occupying & then position it 
		// correctly, taking into account the lot dimensions.
		if (orientation % 2 === 1) {
			[width, depth] = [depth, width];
		}
		let rect = position({
			minX: 16*x - width/2,
			maxX: 16*x + width/2,
			minZ: 16*z - depth/2,
			maxZ: 16*z + depth/2,
		}, lot);

		// Create the prop.
		let prop = new Prop({
			mem: this.mem(),

			...rect,
			minY: lot.yPos + y,
			maxY: lot.yPos + y + height,
			orientation: (orientation + lot.orientation) % 4,

			// Store the TGI of the prop.
			TID: exemplar.type,
			GID: exemplar.group,
			IID: exemplar.instance,
			IID1: exemplar.instance,
			OID: this.mem(),

			appearance: 5,
			state: 1,

		});
		setTract(prop);

		// Push in the file with all props.
		let { dbpf } = this;
		let { props } = dbpf;
		props.push(prop);

		// Put the prop in the index.
		this.addToItemIndex(prop, FileType.PropFile);

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

			// Apparently the "insets" the texture with 0.1, which gets 
			// rounded of when transformed into a Float32 by the way.
			minX: 16*lot.minX+0.1,
			maxX: 16*lot.maxX-0.1,
			minZ: 16*lot.minZ+0.1,
			maxZ: 16*lot.maxZ-0.1,

			// TODO: This is only for flat cities, should use terrain queries 
			// later on!
			minY: 270,
			maxY: 270.1000061035156,

		});
		setTract(texture);

		// Add all required textures.
		let i = 0;
		for (let def of textures) {
			let { orientation, x, z, IID } = def;
			texture.add({
				IID,
				x: lot.minX + Math.floor(x),
				z: lot.minZ + Math.floor(z),
				orientation: (lot.orientation + orientation) % 4,
				// priority: (1-i),
				// u7: i,

			});
			i++;
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
	addToItemIndex(obj, type) {
		let { dbpf } = this;
		let index = dbpf.itemIndexFile;
		for (let x = obj.xMinTract; x <= obj.xMaxTract; x++) {
			for (let z = obj.zMinTract; z <= obj.zMaxTract; z++) {
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
	obj.xMinTract = 64 + Math.floor(obj.minX / xSize);
	obj.xMaxTract = 64 + Math.floor(obj.maxX / xSize);
	obj.zMinTract = 64 + Math.floor(obj.minZ / zSize);
	obj.zMaxTract = 64 + Math.floor(obj.maxZ / zSize);
}

// ## position(rect, lot)
// Modifies the given rectangle so that it is positioned correctly on the 
// given lot. Returns an object { minX, maxX, minZ, maxZ } that can be easily 
// assigned to the object.
function position(rect, lot) {
	let { minX, maxX, minZ, maxZ } = rect;
	function move({ minX, maxX, minZ, maxZ }) {
		let x = 16*lot.minX;
		let z = 16*lot.minZ;
		return {
			minX: x + minX,
			maxX: x + maxX,
			minZ: z + minZ,
			maxZ: z + maxZ,
		};
	}

	// Find the width & the depth of the lot. We can get this from the lot 
	// itself, but this doesn't take into account yet that the lot is rotated, 
	// so that's something we still need to do ourselves.
	let { width, depth } = lot;
	if (lot.orientation % 2 === 1) {
		[width, depth] = [16*depth, 16*width];
	} else {
		width *= 16;
		depth *= 16;
	}

	// TODO: Don't think this works, but we need a lot that's a bit more 
	// "cornered", otherwise we won't be able to see the effects of it.
	switch (lot.orientation) {
		case 0x01:
			return move({
				minX: width-maxZ,
				maxX: width-minZ,
				minZ: minX,
				maxZ: maxX,
			});
		case 0x02:
			return move({
				minX: width-maxX,
				maxX: width-minX,
				minZ: depth-maxZ,
				maxZ: depth-minZ,
			});
		case 0x03:
			return move({
				minX: minZ,
				maxX: maxZ,
				minZ: depth-maxX,
				maxZ: depth-minX,
			});
		default: {
			return move({
				minX,
				maxX,
				minZ,
				maxZ,
			});
		}
	}

}
