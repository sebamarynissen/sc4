// # compare-load-order-test.ts
import { expect } from 'chai';
import createComparator from '../create-load-comparator.js';

describe('#createLoadComparator()', function() {

	it('loads .SC4Lot, then .dat', function() {

		const compare = createComparator();
		const files = [
			'a.dat',
			'b.SC4Lot',
		];
		files.sort(compare);
		expect(files).to.eql(['b.SC4Lot', 'a.dat']);

	});

	it('loads files, then folders', function() {

		const compare = createComparator();
		const files = [
			'a/foo.dat',
			'b.dat',
		];
		files.sort(compare);
		expect(files).to.eql(['b.dat', 'a/foo.dat']);

	});

	it('uses uppercases names', function() {

		const compare = createComparator();
		const files = [
			'Z.dat',
			'a.dat',
		];
		files.sort(compare);
		expect(files).to.eql(['a.dat', 'Z.dat']);

	});

	it('loads nested files first', function() {

		const compare = createComparator();
		const files = [
			'B/nested/file.dat',
			'B/file.SC4Lot',
			'a/nested/file.dat',
			'a/file.dat',
		];
		files.sort(compare);
		expect(files).to.eql([
			'a/file.dat',
			'a/nested/file.dat',
			'B/file.SC4Lot',
			'B/nested/file.dat',
		]);

	});

	it('all together now', function() {

		const files = [
			'z.SC4Lot',
			'k.dat',
			'L.dat',
			'a/file.dat',
			'a/subfolder/file.dat',
			'B/zz_file.dat',
			'B/subfolder/file.dat',
			'B/subfolder/deeper/file.dat',
		];
		const reverse = files.toReversed();
		reverse.sort(createComparator());
		expect(reverse).to.eql(files);

	});

});
