// # tgi-index-test.js
import { expect } from 'chai';
import Index from '../tgi-index.js';

class TGI {
	type = 0;
	group = 0;
	instance = 0;
	constructor(type: number, group: number, instance: number) {
		this.type = type;
		this.group = group;
		this.instance = instance;
	}
}

const fn = (create: (arr: any[]) => Index) => () => {
	describe('#find()', function() {

		it('queries by TGI', function() {

			let values = [
				new TGI(1, 0, 0),
				new TGI(1, 10, 0),
				new TGI(1, 0, 1),
				new TGI(2, 3, 1),
			];
			let index = create(values);

			expect(index.findOne(1, 10, 0)).to.equal(values[1]);
			expect(index.findOne(1, 11, 0)).to.be.undefined;
			expect(index.findOne(1, 10, 1)).to.be.undefined;
			expect(index.findOne(2, 3, 1)).to.equal(values[3]);

		});

		it('queries by TG', function() {

			let values = [
				new TGI(1, 0, 0),
				new TGI(1, 10, 0),
				new TGI(1, 0, 1),
				new TGI(2, 3, 1),
			];
			let index = create(values);

			expect(index.findAll({ type: 1, group: 0 })).to.have.length(2);
			expect(index.findOne({ type: 1, group: 10 })).to.equal(values[1]);

		});

		it('queries by type', function() {

			let values = [
				new TGI(1, 0, 0),
				new TGI(1, 10, 0),
				new TGI(1, 0, 1),
				new TGI(2, 3, 1),
				new TGI(2, 0, 0),
			];
			let index = create(values);

			expect(index.findAll({ type: 1 })).to.have.length(3);
			expect(index.findAll({ type: 500 })).to.have.length(0);

		});

		it('queries by instance', function() {

			let values = [
				new TGI(5, 3, 13),
				new TGI(6, 3, 13),
				new TGI(3, 2, 12),
			];
			let index = create(values);

			expect(index.findOne({ instance: 13 })).to.equal(values[1]);
			expect(index.findOne({ instance: 12 })).to.equal(values[2]);
			expect(index.findOne({ instance: 4 })).to.be.undefined;

		});

		it('queries by type and instance', function() {

			let values = [
				new TGI(5, 3, 13),
				new TGI(6, 3, 13),
				new TGI(3, 2, 12),
			];
			let index = create(values);

			expect(index.findOne({ type: 5, instance: 13 })).to.equal(values[0]);
			expect(index.findOne({ type: 6, instance: 13 })).to.equal(values[1]);
			expect(index.findOne({ type: 7, instance: 13 })).to.be.undefined;

		});

		it('performs a function query', function() {

			let values = [
				new TGI(4, 5, 6),
				new TGI(1, 2, 3),
			];
			let index = create(values);
			let result = index.findAll(tgi => tgi.type === 1);
			expect(result).to.have.length(1);
			expect(result[0]).to.equal(values[1]);
			expect(index.find(() => false)).to.be.undefined;

		});

	});

	describe('#add()', function() {

		it('adds a new entry to the index', function() {

			let values = [
				new TGI(10, 0, 1),
				new TGI(10, 1, 1),
				new TGI(5, 3, 4),
			];
			let index = create(values);
			let added = new TGI(5, 3, 5);
			index.add(added);
			expect(index.findOne(added)).to.equal(added);

			let all = index.findAll({ type: 5 });
			expect(all).to.have.length(2);

			let groups = index.findAll({ type: 5, instance: 5 });
			expect(groups).to.have.length(1);
			expect(index.findOne({ type: 5, instance: 5 })).to.equal(added);

		});

	});

	describe.skip('#remove()', function() {});

};

describe('The TGI index', function() {

	describe('indexed', fn(values => {
		let index = new Index(...values);
		index.build();
		return index;
	}));

	describe('non-indexed', fn(values => new Index(...values)));

});
