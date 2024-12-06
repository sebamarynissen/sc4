import type { SetOptional } from 'type-fest';

export type uint32 = number;
export type TGILiteral = {
	type: uint32;
	group: uint32;
	instance: uint32;
}
export type TGIQuery = SetOptional<TGILiteral, keyof TGILiteral>;
