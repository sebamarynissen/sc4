// # savegame.js
import DBPF from './dbpf.js';
import FileType from './file-types.js';
import type { DecodedFileTypeId, SimGridFileTypeId } from './types.js';
import type TerrainMap from './terrain-map.js';
import { kFileTypeArray } from './symbols.js';
import { getConstructorByType } from './file-classes-helpers.js';
import { type SimGrid } from './enums.js';
import type {
	SimGridFloat32,
	SimGridSint16, 
	SimGridSint8,
	SimGridUint16,
	SimGridUint32,
	SimGridUint8,
} from './sim-grid-file.js';
import type { EntryFromType } from './dbpf-entry.js';

type SimGrid =
	| SimGridUint8
	| SimGridSint8
	| SimGridUint16
	| SimGridSint16
	| SimGridUint32
	| SimGridFloat32;

// Generic type that knows what the result of entry.read() is based on a file's 
// type id.
type Result<T extends DecodedFileTypeId> = ReturnType<EntryFromType<T>['read']>;

// # Savegame()
// A class specifically designed for some Savegame functionality. Obviously 
// extends the DBPF class because savegames are dbpf files.
export default class Savegame extends DBPF {

	// ## get GID()
	// Every savegame has a group id apparently, which is for all entries the 
	// same. Not sure what this is used for.
	get GID() {
		return this.entries[0].group;
	}

	get lots() { return this.readByType(FileType.Lot); }
	get buildings() { return this.readByType(FileType.Building); }
	get props() { return this.readByType(FileType.Prop); }
	get textures() { return this.readByType(FileType.BaseTexture); }
	get flora() { return this.readByType(FileType.Flora); }
	get itemIndex() { return this.readByType(FileType.ItemIndex); }
	get zoneDeveloper() { return this.readByType(FileType.ZoneDeveloper); }
	get zones() { return this.zoneDeveloper; }
	get lotDeveloper() { return this.readByType(FileType.LotDeveloper); }
	get zoneManager() { return this.readByType(FileType.ZoneManager); }
	get COMSerializer() { return this.readByType(FileType.COMSerializer); }
	get lineItems() { return this.readByType(FileType.LineItem); }
	get departmentBudgets() { return this.readByType(FileType.DepartmentBudget); }
	get pipes() { return this.readByType(FileType.Pipe); }
	get plumbingSimulator() { return this.readByType(FileType.PlumbingSimulator); }
	get network() { return this.readByType(FileType.Network); }
	get tunnels() { return this.readByType(FileType.NetworkTunnelOccupant); }
	get bridges() { return this.readByType(FileType.NetworkBridgeOccupant); }
	get prebuiltNetwork() { return this.readByType(FileType.PrebuiltNetwork); }
	get networkIndex() { return this.readByType(FileType.NetworkIndex); }
	get networkManager() { return this.readByType(FileType.NetworkManager); }

	// ## get regionView()
	get regionView() { return this.readByType(FileType.RegionView); }

	// ## get terrain()
	// The terrain is a bit special because there are multiple instances of - 
	// probably used for the neighbour connections.
	get terrain(): TerrainMap {
		let entry = this.find({
			type: FileType.TerrainMap,
			instance: 0x01,
		});
		return entry!.read();
	}

	// ## get width()
	// Getter for easily accessing the width of the city. We read this from the 
	// terrain map.
	get width() {
		return (this.terrain?.xSize ?? 1) - 1;
	}

	// ## get depth()
	// Same for the city depth.
	get depth() {
		return (this.terrain?.zSize ?? 1) - 1;
	}

	// ## getSimGrid(dataId, type)
	// Returns the sim grid with the given data id. Note that we used to specify 
	// the file type as well, but we only accept this as a hint now. It's not 
	// per se needed anymore.
	getSimGrid(dataId: number, type?: SimGridFileTypeId): SimGrid | undefined {
		if (type !== undefined) {
			let grids = this.readByType(type);
			return grids.find(grid => grid.dataId === dataId);
		} else {
			const types = [
				FileType.SimGridFloat32,
				FileType.SimGridUint32,
				FileType.SimGridSint16,
				FileType.SimGridUint16,
				FileType.SimGridSint8,
				FileType.SimGridUint8,
			];
			for (let type of types) {
				let grid = this.getSimGrid(dataId, type);
				if (grid) return grid;
			}
		}
	}

	// # getByType(type)
	// This method returns an entry in the savegame by type. If it doesn't 
	// exist yet, it is created.
	getByType<T extends DecodedFileTypeId>(type: T): EntryFromType<T> {
		let entry = this.find({ type });
		if (!entry) {
			const Constructor = getConstructorByType(type);
			let { GID: group } = this;
			let instance = 0;
			if (kFileTypeArray in Constructor) {
				entry = this.add({ type, group, instance }, []);
			} else {
				entry = this.add({ type, group, instance }, new Constructor());
			}
		}
		return entry;
	}

	// ## readByType(type)
	// Helper function that reads an entry when it can be returned.
	readByType<T extends DecodedFileTypeId>(type: T): Result<T> {
		return this.getByType(type).read();
	}

}
