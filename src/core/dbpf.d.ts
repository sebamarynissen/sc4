export default class DBPF {
	buffer = Uint8Array | null;
	file = string;
	length: number;
	readBytes(offset: number, length: number): Uint8Array;
	readBytesAsync(offset: number, length: number): Promise<Uint8Array>;
}
