// # build-menu-tree-test.js
import { expect } from 'chai';
import build from '../helpers/build-menu-tree.js';

describe('#buildMenuTree()', function() {
	
	it('builds up a menu tree that is stored in topological order', function() {

		let items = [
			{
				id: 1,
				parent: 0,
				name: 'Grandma',
			},
			{
				id: 2,
				parent: 1,
				name: 'Father',
			},
			{
				id: 3,
				parent: 1,
				name: 'Mother',
			},
			{
				id: 4,
				parent: 3,
				name: 'Brother',
			},
			{
				id: 5,
				parent: 3,
				name: 'Sister',
			},
		];
		let [grandma, dad, mom, bro, sis] = items;
		let roots = build(items);
		expect(roots).to.have.length(1);
		let [tree] = roots;
		expect(tree).to.eql({
			item: grandma,
			children: [
				{ item: dad, children: [] },
				{ item: mom, children: [
					{ item: bro, children: [] },
					{ item: sis, children: [] },
				] },
			],
		});

	});

	it('builds up a menu tree that is stored in reverse topological order', function() {

		let items = [
			{
				id: 4,
				parent: 3,
				name: 'Brother',
			},
			{
				id: 5,
				parent: 3,
				name: 'Sister',
			},
			{
				id: 2,
				parent: 1,
				name: 'Father',
			},
			{
				id: 3,
				parent: 1,
				name: 'Mother',
			},
			{
				id: 1,
				parent: 0,
				name: 'Grandma',
			},
		];
		let [bro, sis, dad, mom, grandma] = items;
		let roots = build(items);
		expect(roots).to.have.length(1);
		let [tree] = roots;
		expect(tree).to.eql({
			item: grandma,
			children: [
				{ item: dad, children: [] },
				{ item: mom, children: [
					{ item: bro, children: [] },
					{ item: sis, children: [] },
				] },
			],
		});

	});

	it('finds multiple root nodes', function() {

		let items = [
			{ id: 1, parent: 0 },
			{ id: 2, parent: 3 },
			{ id: 4, parent: 2 },
			{ id: 5, parent: 2 },
			{ id: 6, parent: 1 },
		];
		let roots = build(items);
		expect(roots).to.have.length(2);
		let ids = roots.map(root => root.item.id);
		expect(ids).to.include.members([1, 2]);

	});

});
