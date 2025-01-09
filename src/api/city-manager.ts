// # city-manager.ts
import { path, fs, hex, getJulianFromUnix } from 'sc4/utils';
import {
	Savegame,
	Lot,
	Building,
	Prop,
	BaseTexture,
	Pointer,
	FileType,
	SimGrid,
	ExemplarProperty as Property,
	Box3,
	type Exemplar,
    type ExemplarPropertyKey as Key,
    type Entry,
    type LotObject,
    type SavegameObject,
    type ArrayFileTypeId,
    type SavegameFileTypeId,
    SavegameContext,
} from 'sc4/core';
import type { PluginIndex } from 'sc4/plugins';
import type { TGIArray, TGIQuery } from 'sc4/types';

const INSET = 0.1;

type CityManagerOptions = {
	dbpf?: Savegame;
	index?: PluginIndex;
};

type Orientation = number;
type PlopOptions = {
	tgi?: TGIQuery | TGIArray;
	building?: Entry<Exemplar>;
	x: number;
	z: number;
	orientation?: Orientation;
};

type GrowOptions = {
	tgi?: TGIQuery | TGIArray;
	lot?: Entry<Exemplar>;
	building?: Entry<Exemplar>;
	x: number;
	z: number;
	orientation?: Orientation;
};

type BuildOptions = {
	lot: Entry<Exemplar>;
	building: Entry<Exemplar>;
	x: number;
	z: number;
	orientation?: Orientation;
};

type ZoneOptions = {
	x: number;
	z: number;
	width?: number;
	depth?: number;
	orientation?: Orientation;
	zoneType?: number;
};

// # CityManager
// A class for performing operations on a certain city, such as plopping 
// arbitrary lots etc. Have a look at https://sc4devotion.com/forums/
// index.php?topic=5656.0, contains a lot of relevant info.
export default class CityManager {
	dbpf: Savegame;
	ctx: SavegameContext;
	index: PluginIndex;

	// ## constructor(opts)
	// Sets up the city manager.
	constructor(opts: CityManagerOptions = {}) {
		let { dbpf, index } = opts;
		if (dbpf) {
			this.dbpf = dbpf;
			this.ctx = dbpf.createContext();
		}
		if (index) this.index = index;
	}

	// ## get city()
	// Alias the dbpf as a city.
	get city() {
		return this.dbpf;
	}

	// ## setFileIndex(index)
	// Stores the file index to be used for looking up TGI's etc. That's 
	// required if you want to plop lot's etc. because in that case we need to 
	// know where to look for the resources!
	setFileIndex(index: PluginIndex) {
		this.index = index;
	}

	// ## load(file)
	// Loads the given savegame into the city manager.
	load(file: string) {

		// No extension given? Add .sc4
		let full = path.resolve(process.env.SC4_REGIONS ?? process.cwd(), file);
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
		this.dbpf = new Savegame({ file: full });
		this.ctx = this.dbpf.createContext();
		return this.dbpf;

	}

	// ## save(opts)
	// Saves the city to the given file.
	save(opts: Parameters<Savegame['save']>[0]) {
		return this.dbpf.save(opts);
	}

	// ## mem()
	// Returns an unused memory address. This is useful if we add new stuff to 
	// a city - such as buildings etc. - because we need to make sure that the 
	// memory addresses for every record are unique.
	mem() {
		return this.ctx.mem();
	}

	// ## getProperty(file, key)
	// Helper function for getting a property from an exemplar, taking into
	// account the inheritance chain. It's the index that is actually 
	// responsible for this though.
	getProperty<K extends Key>(file: Exemplar, key: K) {
		return this.index.getProperty(file, key);
	}

	// ## getPropertyValue(file, prop)
	// Returns the direct value for the given property.
	getPropertyValue<K extends Key>(file: Exemplar, key: K) {
		return this.index.getPropertyValue(file, key);
	}

	// ## plop(opts)
	// Behold, the mother of all functions. This function allows to plop any 
	// lot anywhere in the city. Note that this function expects a *building* 
	// exemplar, which means it only works for *ploppable* buildings. For 
	// growable buildings the process is different, in that case you have to 
	// use the "grow" method.
	plop(opts: PlopOptions) {

		// (1) First of all we need to find the T10 exemplar file with the 
		// information to plop the lot. Most of the time this resides in an 
		// .sc4lot file, but it doesn't have to.
		let { tgi, building } = opts;
		if (!building && tgi) {
			building = this.index.find(tgi as any) as Entry<Exemplar>;
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
		let file = building!.read();
		if (this.getPropertyValue(file, 'ExemplarType') !== Property.ExemplarType.Buildings) {
			throw new Error([
				'The exemplar is not a building exemplar!',
				'The `.plop()` function expects a ploppable building exemplar!',
			].join(' '));
		}

		// Find the lot resource key, which is the IID where we can find the 
		// LotResourceKey & then based on that find the appropriate Building 
		// exemplar. Note that we currently have no other choice than finding 
		// everything with the same instance ID...
		let IID = this.getPropertyValue(file, Property.LotResourceKey)!;
		let lotExemplar = this.findExemplarOfType(
			IID,
			Property.ExemplarType.LotConfigurations
		)!;

		// Cool, we have both the building & the lot exemplar. Create the lot.
		this.build({
			lot: lotExemplar,
			building: building!,
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
	grow(opts: GrowOptions) {

		let {
			lot = this.index.find(opts.tgi as any) as Entry<Exemplar>,
		} = opts;
		if (!lot) {
			throw new Error(
				`Exemplar ${ JSON.stringify(opts.tgi) } not found!`,
			);
		}

		// Ensure that the exemplar that was specified.
		let props = lot.read();
		if (props.get(Property.ExemplarType) !== Property.ExemplarType.LotConfigurations) {
			throw new Error([
				'The exemplar is not a lot configurations exemplar!',
				'The `.grow()` function expects a lot exemplar!',
			].join(' '));
		}

		// Find the appropriate building exemplar. Note that it's possible 
		// that the building belongs to a family. In that case we'll pick a 
		// random building from the family.
		let { building } = opts;
		if (!building) {
			let { IIDs } = props.lotObjects.find(obj => obj.type === 0x00)!;
			let IID = rand(IIDs);
			building = this.findExemplarOfType(IID, 0x02);
			if (!building) {
				let name = props.value(0x20);
				console.warn([
					`Unable to find a building for ${name} (${hex(IID)})!`,
					'You might be missing a dependency!',
				].join(' '));
				return false;
			}
		}

		// Now that we have both the building exemplar and as well as the lot 
		// exemplar we can create the lot and insert everything on it into the 
		// city.
		let { x, z, orientation } = opts;
		return this.build({
			lot,
			building,
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
	build(opts: BuildOptions) {

		// First of all create the lot record & insert it into the city.
		let {
			lot: lotExemplar,
			building,
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
	zone(opts: ZoneOptions) {
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

			// An empty growable lot has this flag set to 0, but to 1 when 
			// it's powered. In theory we need to check hence if the lot is 
			// reachable by power, but apparently the game does this by 
			// itself! The only thing we need to make sure is that the second 
			// bit is **never** set to 1! Otherwise the lot is considered as 
			// being built!
			flag2: 0b00000001,

			jobCapacities: [{
				demandSourceIndex: 0x00003320,
				capacity: 0,
			}],

		});
		lots.push(lot);

		// Put in the zone developer file & update the Zone View Sim Grid.
		let grid = dbpf.getSimGrid(SimGrid.ZoneData)!;
		for (let x = lot.minX; x <= lot.maxX; x++) {
			for (let z = lot.minZ; z <= lot.maxZ; z++) {
				grid.set(x, z, zoneType);
				zones.cells[x][z] = new Pointer(lot);
			}
		}

		// At last update the com serializer.
		let com = dbpf.COMSerializer;
		com.set(FileType.Lot, lots.length);

		// Return the created zone.
		return lot;

	}

	// ## createLot(opts)
	// Creates a new lot object from the given options when plopping a lot.
	createLot(opts: {
		exemplar: Entry<Exemplar>;
		building: Entry<Exemplar>;
		x: number;
		z: number;
		orientation: Orientation;
	}) {

		// Read in the size of the lot because we'll still need it.
		let { dbpf } = this;
		let { lots } = dbpf;
		let { exemplar, x, z, building, orientation = 0 } = opts;
		let file = exemplar.read();
		let [width, depth] = this.getPropertyValue(
			file,
			Property.LotConfigPropertySize,
		)!;

		// Determine the zone type.
		let zoneTypes = this.getPropertyValue(
			file,
			Property.LotConfigPropertyZoneTypes,
		) ?? [];
		let zoneType = zoneTypes[0] || 0x0f;

		// Determine the zoneWealth as well. Note that this is to be taken 
		// **from the building**.
		let buildingFile = building.read();
		let zoneWealth = this.getPropertyValue(buildingFile, Property.Wealth);

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
		let zones = dbpf.zoneDeveloper;
		let grid = dbpf.getSimGrid(SimGrid.ZoneData)!;
		for (let x = lot.minX; x <= lot.maxX; x++) {
			for (let z = lot.minZ; z <= lot.maxZ; z++) {
				zones.cells[x][z] = new Pointer(lot);
				grid.set(x, z, zoneType);
			}
		}

		// Don't forget to update the COMSerializer to include the updated 
		// length! Otherwise the lot won't show up!
		let com = dbpf.COMSerializer;
		com.set(FileType.Lot, lots.length);

		// Return the lot that we've just created.
		return lot;

	}

	// ## createBuilding(opts)
	// Creates a new building record and inserts it into the savegame.
	createBuilding(opts: {
		lot: Lot,
		lotObject: LotObject;
		exemplar: Entry<Exemplar>;
	}) {
		let { lot, lotObject, exemplar } = opts;
		let file = exemplar.read();
		let [, height] = this.getPropertyValue(file, Property.OccupantSize)!;
		let { orientation, y } = lotObject;

		// Create the building.
		let { terrain } = this.dbpf;
		let { minX, maxX, minZ, maxZ } = position(lotObject, lot);
		let yPos = terrain!.query(0.5*(minX + maxX), 0.5*(minZ + maxZ));
		let building = new Building({
			mem: this.mem(),

			// Now use the **rotated** building rectangle and use it to 
			// position the building appropriately.
			bbox: new Box3([minX, yPos+y, minZ], [maxX, yPos+y+height, maxZ]),
			orientation: (orientation + lot.orientation) % 4,

			// Store the TGI of the building exemplar.
			TID: exemplar.type,
			GID: exemplar.group,
			IID: exemplar.instance,
			IID1: exemplar.instance,

		});
		building.tract.update(building);

		// Put the building in the index at the correct spot.
		let { dbpf } = this;
		this.addToItemIndex(building, FileType.Building);

		// Push in the file with all buildings.
		let { buildings } = dbpf;
		buildings.push(building);

		// Add to the lot developer file as well.
		let dev = dbpf.lotDeveloper;
		dev.buildings.push(new Pointer(building));

		// At last update the COMSerializer file.
		let com = dbpf.COMSerializer;
		com.set(FileType.Building, buildings.length);
		return building;

	}

	// ## createProp(opts)
	// Creates a new prop record in and inserts it into the save game. Takes 
	// into account the position it should take up in a lot.
	createProp({ lot, lotObject }: {
		lot: Lot;
		lotObject: LotObject;
	}) {

		// Note: in contrast to the building, we don't know yet what prop 
		// we're going to insert if we're dealing with a prop family. As such 
		// we'll check the families first.
		let { OID, IIDs, orientation, y } = lotObject;
		let IID = rand(IIDs);
		let exemplarEntry = this.findExemplarOfType(IID, 0x1e);

		// Missing props? Just ignore them.
		if (!exemplarEntry) {
			return 0;
		}

		// Get the dimensions of the prop bounding box.
		let exemplar = this.index.getHierarchicExemplar(exemplarEntry.read());
		let size = exemplar.get('OccupantSize');
		if (!size) {
			console.warn(`Prop ${exemplarEntry.tgi} is missing OccupantSize!`);
			return 0;
		}
		let [, height] = size;

		// If the prop is used with a start date, we'll check the current date 
		// in the city to determine whether the prop should be active or not.
		let condition = 0x00;
		let startMonthDay = exemplar.get('SimulatorDateStart');
		let timing = null;
		let state = 0;
		let powerNeeded = exemplar.get('RequiresPowerToAppear');
		let powerFlag = powerNeeded ? 0x00 : 0x08;
		if (startMonthDay) {

			// Read in the current date of the city, and then we'll check if the 
			// prop should be active during this interval.
			let duration = exemplar.get('SimulatorDateDuration') ?? 0;
			let interval = exemplar.get('SimulatorDateInterval') ?? 0;
			let [startMonth, startDay] = startMonthDay;
			let { date } = this.dbpf.date;
			let start = date.with({ month: startMonth, day: startDay });
			let end = start.add({ days: duration });
			if (date <= end) {
				if (date < start) {
					state = 1;
					condition = 0x05 | powerFlag;
				} else {
					start = start.add({ years: 1 });
					state = 0;
					condition = 0x0f;
				}
			} else {
				start = start.add({ years: 1 });
				end = end.add({ years: 1 });
				if (date >= start) {
					start = start.add({ years: 1 });
					state = 0;
					condition = 0x0f;
				} else {
					state = 1;
					condition = 0x05 | powerFlag;
				}
			}
			timing = {
				interval,
				duration,
				start,
				end,
			};
			console.log(timing);
		}

		// Create the prop & position correctly.
		let { terrain } = this.dbpf;
		let { minX, maxX, minZ, maxZ } = position(lotObject, lot);
		let yPos = terrain!.query(0.5*(minX + maxX), 0.5*(minZ + maxZ));
		let prop = new Prop({
			mem: this.mem(),
			bbox: new Box3([minX, yPos+y, minZ], [maxX, yPos+y+height, maxZ]),
			orientation: (orientation + lot.orientation) % 4,

			// Store the TGI of the prop.
			TID: exemplarEntry.type,
			GID: exemplarEntry.group,
			IID: exemplarEntry.instance,
			IID1: exemplarEntry.instance,
			OID,

			appearance: 5,
			state,
			condition,
			timing,

		});
		prop.tract.update(prop);

		// Push in the file with all props.
		let { dbpf } = this;
		let { props } = dbpf;
		props.push(prop);

		// If it's a timed prop, we have to reference it in the prop developer 
		// as well.
		if (startMonthDay) {
			dbpf.propDeveloper.array5.push(new Pointer(prop));
		}

		// Put the prop in the index.
		this.addToItemIndex(prop, FileType.Prop);

		// Update the COM serializer and we're done.
		let com = dbpf.COMSerializer;
		com.set(FileType.Prop, props.length);
		return props;

	}

	// ## createTexture(opts)
	// Creates a texture entry in the BaseTexture file of the city for the 
	// given lot.
	createTexture(opts: {
		lot: Lot;
		textures: LotObject[];
	}) {

		// Apparently the game requires "insets" on the texture - which it 
		// sets to 0.1, which get rounded to Float32's by the way.
		let { lot, textures } = opts;
		let minX = 16*lot.minX + INSET;
		let maxX = 16*(lot.maxX+1) - INSET;
		let minZ = 16*lot.minZ + INSET;
		let maxZ = 16*(lot.maxZ+1) - INSET;

		// TODO: This is only for flat cities, should use terrain queries 
		// later on!
		let minY = lot.yPos;
		let maxY = lot.yPos + INSET;

		// Create a new texture instance and copy some lot properties in it.
		let texture = new BaseTexture({
			mem: this.mem(),
			bbox: new Box3([minX, minY, minZ], [maxX, maxY, maxZ]),
		});
		texture.tract.update(texture);

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
		let com = dbpf.COMSerializer;
		com.set(FileType.BaseTexture, dbpf.textures.length);

		// Update the item index as well.
		this.addToItemIndex(texture, FileType.BaseTexture);

		// Return the base texture that we've created.
		return texture;

	}

	// ## addToItemIndex(obj)
	// Helper function for adding the given object - that exposes the tract 
	// coordinates - to the item index.
	addToItemIndex(obj: SavegameObject, type: number) {
		this.dbpf.itemIndex.add(obj, type);
	}

	// ## findExemplarOfType(IID, type)
	// Helper function that can find an exemplar with the given instance of 
	// the given type. It will make use of the families we have as well.
	findExemplarOfType(IID: number, type: number) {
		let { index } = this;
		let family = index.family(IID);
		const filter = (entry: Entry<Exemplar>) => {
			let file = entry.read();
			return index.getPropertyValue(file, 0x10) === type;
		};
		if (family) {
			let exemplars = family.filter(filter);
			return exemplars[ Math.random()*exemplars.length | 0 ];
		} else {
			return index
				.findAll({ type: FileType.Exemplar, instance: IID })
				.filter(filter)
				.at(-1);
		}
	}

	// ## clear()
	// Clears the entire city from lots, props textures and flora. Note that 
	// this function is incomplete as it is not fully understood yet how all the 
	// pieces in a city work together. For example, when clearing a city, the 
	// terrain textures won't show up again. That's probably because a flag is 
	// set somewhere that terrain should not be shown, but we haven't figured it 
	// out yet where this is stored.
	clear() {
		const { city } = this;
		const index = city.itemIndex;
		const com = city.COMSerializer;
		const clear = (type: ArrayFileTypeId & SavegameFileTypeId) => {
			let file = city.readByType(type) as SavegameObject[];
			if (file) {
				file.length = 0;
				index.rebuild(type, file);
				com.set(type, 0);
			}
		};
		clear(FileType.Lot);
		clear(FileType.Building);
		clear(FileType.Prop);
		clear(FileType.Flora);
		clear(FileType.BaseTexture);

		// Clear both the lot and zone developer files as well.
		city.lotDeveloper.clear();
		city.zoneDeveloper.clear();

		// Clear some simgrids.
		city.getSimGrid(SimGrid.ZoneData)?.clear();
		city.getSimGrid(SimGrid.Power)?.clear();

		// Render all terrain tiles again.
		city.terrainFlags.clear();

	}

}

// ## orient([x, y], lot, opts)
// Helper function for transforming the point [x, y] that is given in 
// **local** lot coordinates into global **city** coordinates. Note that local 
// lot coordinates use an origin in the bottom-left corner of the lot with an 
// y axis that is going up. This means that we'll need to invert properly!
function orient(
	[x, y]: [number, number],
	lot: Lot,
	opts: { bare?: boolean } = {},
): [number, number] {
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
			16*lot.minX + x,
			16*lot.minZ + y,
		];
	}

}

// ## position(lotObject, lot)
// Returns the rectangle we need to position the given lotObject on, taken 
// into account it's positioned on the given lot.
function position(lotObject: LotObject, lot: Lot) {
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
function rand<T>(arr: T[]): T {
	return arr[Math.random()*arr.length | 0];
}
