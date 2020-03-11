// # city-manager.js
"use strict";
const path = require('path');
const fs = require('fs');
const Savegame = require('./savegame.js');
const Lot = require('./lot.js');
const Building = require('./building.js');
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
		let { tgi } = opts;
		let record = this.index.find(tgi);
		if (!record) {
			throw new Error(
				`Exemplar ${ JSON.stringify(tgi) } not found!`,
			);
		}

		// Check what type of exemplar we're dealing with. As explained by 
		// RippleJet, there's a fundamental difference between ploppable and 
		// growable buildings. Apparently ploppable buildings start from a 
		// building exemplar and then we can look up according 
		// LotConfiguration exemplar.
		let exemplar = record.read();
		if (+exemplar.prop(ExemplarType) !== Buildings) {
			throw new Error([
				'The exemplar is not a building exemplar!',
				'The `.plop()` function expects a ploppable building exemplar!'
			].join(' '));
		}

		// Find the lot resource key, which is the IID where we can find the 
		// LotResourceKey & then based on that find the appropriate Building 
		// exemplar. Note that we currently have no other choice than finding 
		// everything with the same instance ID...
		let IID = +exemplar.prop(LotResourceKey);
		let exemplars = this.index.findAllTI(FileType.Exemplar, IID);
		let lotExemplar = exemplars.find(record => {
			let exemplar = record.read();
			return +exemplar.prop(ExemplarType) === LotConfigurations;
		});

		// Create the lot. It will automatically insert it into the zone 
		// developer file as well.
		let lot = this.createLot({
			exemplar: lotExemplar,
			x: opts.x,
			z: opts.z,
			building: IID,
		});

		// Now loop all objects on the lot such as the building, the props 
		// etc. and insert them.
		let { lotObjects } = lotExemplar.read();
		for (let lotObject of lotObjects) {
			switch (lotObject.type) {
				case 0x00:
					this.createBuilding({
						lot,
						lotObject,
						exemplar: record,
					});
				case 0x02:
					this.createTexture({
						lot,
						lotObject,
					});
			}
		}

	}

	// ## createLot(opts)
	// Creates a new lot object from the given options when plopping a lot.
	createLot(opts) {

		// Read in the size of the lot because we'll still need it.
		let { exemplar, x, z, building, orientation = 0 } = opts;
		let file = exemplar.read();
		let [width, height] = file.prop(LotConfigPropertySize).value;
		if (orientation % 2 === 1) {
			[width, height] = [height, width];
		}

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
			maxX: x+width,
			minZ: z,
			maxZ: z+height,
			commuteX: x,
			commuteZ: z,
			depth: height,
			width: width,
			orientation: orientation,

		});

		// Push the lot in the lotFile.
		let { dbpf } = this;
		let lots = dbpf.lotFile;
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
		let [width, height, depth] = file.prop(OccupantSize).value;
		let { orientation, x, y, z } = lotObject;

		// Create the building.
		let building = new Building({
			mem: this.mem(),

			// TODO: we need to rotate the building into place here!
			minX: 16*lot.minX + x,
			maxX: 16*lot.minX + x + width,
			minZ: 16*lot.minZ + z,
			maxZ: 16*lot.maxZ + z + depth,
			minY: lot.yPos + y,
			maxY: lot.yPos + y + height,
			orientation: (orientation + lot.orientation) % 4,

			TID: exemplar.type,
			GID: exemplar.group,
			IID: exemplar.instance,
			IID1: exemplar.instance,

		});

		// Set the correct tract for the building & then put inside the item 
		// index.
		setTract(building);
		let { dbpf } = this;
		let index = dbpf.itemIndexFile;
		for (let x = building.xMinTract; x <= building.xMaxTract; x++) {
			for (let z = building.zMinTract; z <= building.zMaxTract; z++) {
				index[x][z].push({
					mem: building.mem,
					type: FileType.BuildingFile,
				});
			}
		}

		// Push in the file with all buildings.
		let buildings = dbpf.buildingFile;
		buildings.push();

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

	// ## createTexture(opts)
	// Creates a base texture.
	createTexture(opts) {
		// let { lot, lotObject } = opts;
		// let { orientation, x, y, z } = lotObject;
	}

}

module.exports = CityManager;

// ## setTract(obj)
// Helper function for setting the correct "Tract" values in the given object 
// based on its bounding box.
function setTract(obj) {
	const xSize = 2 ** obj.xTractSize;
	const ySize = 2 ** obj.yTractSize;
	obj.xMinTract = 64 + Math.floor(obj.minX / xSize);
	obj.xMaxTract = 64 + Math.floor(obj.maxX / xSize);
	obj.yMinTract = 64 + Math.floor(obj.minY / ySize);
	obj.yMaxTract = 64 + Math.floor(obj.maxY / ySize);
}
