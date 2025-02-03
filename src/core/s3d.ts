// # s3d.ts
import { hex } from 'sc4/utils';
import FileType from './file-types.js';
import Stream from './stream.js';
import { kFileType } from './symbols.js';
import Vector3 from './vector-3.js';

// # S3D
// An implementation of the SimGlide (S3D) format.
export default class S3D {
	static [kFileType] = FileType.S3D;
	headers: any = {};
	version = '1.5';
	vertexGroups: VertexGroup[] = [];
	indexGroups: number[][] = [];
	primGroups: PrimGroup[][] = [];
	materialGroups: MaterialGroup[] = [];
	animations: AnimationSection = new AnimationSection();
	properties: PropGroup[] = [];
	regpGroups: RegpGroup[] = [];
	parse(rs: Stream) {
		this.headers = {};
		section(rs, '3DMD');
		section(rs, 'HEAD');
		this.version = rs.version(2);
		let [major, minor] = this.version.split('.').map(Number);
		section(rs, 'VERT');
		this.vertexGroups = rs.array(() => new VertexGroup().parse(rs));
		section(rs, 'INDX')
		this.indexGroups = rs.array(() => {
			let flags = rs.uint16();
			if (flags !== 0) throw new Error(`Unknown flags were not 0: ${hex(flags, 4)}`);
			rs.uint16();
			return rs.array(() => rs.uint16(), rs.uint16());
		});
		section(rs, 'PRIM');
		this.primGroups = rs.array(() => {
			return rs.array(() => new PrimGroup().parse(rs), rs.uint16());
		});
		section(rs, 'MATS');
		this.materialGroups = rs.array(() => {
			let group = new MaterialGroup();
			group.parse(rs, [major, minor]);
			return group;
		});
		section(rs, 'ANIM');
		this.animations = new AnimationSection().parse(rs);
		section(rs, 'PROP');
		this.properties = rs.array(() => new PropGroup().parse(rs));
		section(rs, 'REGP');
		this.regpGroups = rs.array(() => new RegpGroup().parse(rs));
		rs.assert();
		console.log(this.headers);
		return this;
	}

	// # toBuffer()
	toBuffer() {

	}

}

// # section(rs, signature)
// Parses a section identifier & size. We don't do anything with it though.
function section(rs: Stream, signature: string) {
	let id = rs.string(4);
	if (id !== signature) {
		throw new Error(`${signature} signature was ${id}`);
	}
	return rs.size();
}

const VERTEX_FORMAT = 0x80004001;
class VertexGroup {
	flags = 0;
	format: number = VERTEX_FORMAT;
	vertices: Vertex[] = [];
	parse(rs: Stream) {
		this.flags = rs.uint16();
		let numVertices = rs.uint16();
		this.format = rs.uint32();
		this.vertices = rs.array(() => new Vertex().parse(rs), numVertices);
		return this;
	}
}

class Vertex {
	x = 0;
	y = 0;
	z = 0;
	u = 0;
	v = 0;
	parse(rs: Stream) {
		this.x = rs.float();
		this.y = rs.float();
		this.z = rs.float();
		this.u = rs.float();
		this.v = rs.float();
		return this;
	}
}

class PrimGroup {
	type = 0;
	first = 0;
	numIndex = 0;
	parse(rs: Stream) {
		this.type = rs.uint32();
		this.first = rs.uint32();
		this.numIndex = rs.uint32();
		return this;
	}
}

class MaterialGroup {
	flags = 0;
	alphaFunc = 0;
	depthFunc = 0;
	sourceBlend = 0;
	destBlend = 0;
	alphaThreshold = 0;
	matClass = 0;
	reserved = 0;
	textures: MaterialGroupTexture[] = [];
	parse(rs: Stream, version: [number, number]) {
		this.flags = rs.uint32();
		this.alphaFunc = rs.byte();
		this.depthFunc = rs.byte();
		this.sourceBlend = rs.byte();
		this.destBlend = rs.byte();
		this.alphaThreshold = rs.uint16();
		this.matClass = rs.uint32();
		this.reserved = rs.byte();
		this.textures = rs.array(() => {
			let texture = new MaterialGroupTexture();
			texture.parse(rs, version);
			return texture;
		}, rs.byte());
		return this;
	}
}

class MaterialGroupTexture {
	id = 0;
	wrapU = 0;
	wrapV = 0;
	magFilter = 0;
	minFilter = 0;
	animRate = 0;
	animMode = 0;
	name = '';
	parse(rs: Stream, version: [number, number]) {
		let [, minor] = version;
		this.id = rs.uint32();
		this.wrapU = rs.byte();
		this.wrapV = rs.byte();
		this.magFilter = minor < 5 ? 0 : rs.byte();
		this.minFilter = minor < 5 ? 0 : rs.byte();
		this.animRate = rs.uint16();
		this.animMode = rs.uint16();
		this.name = rs.string(rs.byte()).slice(0, -1);
		return this;
	}
}

class AnimationSection {
	numFrames = 0;
	frameRate = 0;
	playMode = 0;
	flags = 0;
	displacement = 0.0;
	groups: AnimationGroup[] = [];
	parse(rs: Stream) {
		this.numFrames = rs.uint16();
		this.frameRate = rs.uint16();
		this.playMode = rs.uint16();
		this.flags = rs.uint32();
		this.displacement = rs.float();
		this.groups = rs.array(
			() => new AnimationGroup().parse(rs, this),
			rs.uint16(),
		);
		return this;
	}
}

type BlockIndex = [number, number, number, number];
class AnimationGroup {
	flags = 0;
	name = '';
	blockIndices: BlockIndex[] = [];
	parse(rs: Stream, section: AnimationSection) {
		let nameLength = rs.byte();
		this.flags = rs.byte();
		this.name = rs.string(nameLength);
		this.blockIndices = rs.array(() => {
			return rs.array(() => rs.uint16(), 4) as BlockIndex;
		}, section.numFrames);
		return this;
	}
}

class PropGroup {
	meshIndex = 0;
	frameIndex = 0;
	assignmentType = '';
	assignedValue = '';
	parse(rs: Stream) {
		this.meshIndex = rs.uint16();
		this.frameIndex = rs.uint16();
		this.assignmentType = rs.string(rs.byte());
		this.assignedValue = rs.string(rs.byte());
		return this;
	}
}

class RegpGroup {
	name = '';
	groups: any;
	parse(rs: Stream) {
		this.name = rs.string(rs.byte());
		this.groups = rs.array(() => new RegpSubgroup().parse(rs), rs.uint16());
		return this;
	}
}

class RegpSubgroup {
	translation: Vector3 = new Vector3();
	orientation: [number, number, number, number] = [0, 0, 0, 0];
	parse(rs: Stream) {
		this.translation = rs.vector3();
		this.orientation = [rs.float(), rs.float(), rs.float(), rs.float()];
		return this;
	}
}
