// # get-oriented-position-test.ts
import { Lot, LotObject, Vector3 } from 'sc4/core';
import getOrientedPosition from '../get-oriented-position.js';
import { expect } from 'chai';

describe('#getOrientedPosition()', function() {

	it('orientation 0', function() {

		let lot = new Lot({
			width: 3,
			depth: 1,
			orientation: 0,
		});
		let lotObject = new LotObject({ x: 0, z: 0 });
		let position = getOrientedPosition({ lot, lotObject });
		expect(position).to.eql(new Vector3(3*16, 0, 16));

	});

	it('orientation 1', function() {

		let lot = new Lot({ width: 1, depth: 4, orientation: 1 });
		let lotObject = new LotObject({ x: 8, z: 4*16 });
		let position = getOrientedPosition({ lot, lotObject });
		expect(position).to.eql(new Vector3(4*16, 0, 8));

	});

	it('orientation 2', function() {

		let lot = new Lot({ width: 5, depth: 3, orientation: 2 });
		let lotObject = new LotObject({ x: 1, z: 16 });
		let position = getOrientedPosition({ lot, lotObject });
		expect(position).to.eql(new Vector3(1, 0, 16));

	});

	it('orientation 3', function() {

		let lot = new Lot({ width: 8, depth: 16, orientation: 3 });
		let lotObject = new LotObject({ x: 3*16, y: 1, z: 1 });
		let position = getOrientedPosition({ lot, lotObject });
		expect(position).to.eql(new Vector3(16*16-1, 1, 3*16));

	});

});
