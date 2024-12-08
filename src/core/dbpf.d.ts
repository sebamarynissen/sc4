import type Header from "./dbpf-header.js";

export default class DBPF {
	buffer = Uint8Array | null;
	file = string;
	length: number;
	header: Header;
	readBytes(offset: number, length: number): Uint8Array;
	readBytesAsync(offset: number, length: number): Promise<Uint8Array>;
}
