import type { SetOptional } from 'type-fest';

export type TGILiteral = {
	type: number;
	group: number;
	instance: number;
}

export type TGIQuery = SetOptional<TGILiteral, keyof TGILiteral>;
