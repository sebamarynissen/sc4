// # file-scanner-test.js
import { expect } from 'chai';
import { createFsFromVolume, Volume } from 'memfs';
import path from 'node:path';
import FileScanner from '../file-scanner.js';

describe('The FileScanner', function() {

	before(function() {
		const vol = Volume.fromJSON({
			'SimCity 4/Plugins/sc4fix.dll': 'sc4fix',
			'SimCity 4/Plugins/075-my-plugins/some-mod.dat': '',
			'SimCity 4/Plugins/075-my-plugins/some-lot.sc4lot': '',
			'SimCity 4/Plugins/360-landmark/diego-del-llano.432-park-avenue.dark.1.sc4pac/lot.SC4Lot': '',
			'SimCity 4/Plugins/360-landmark/diego-del-llano.432-park-avenue.dark.1.sc4pac/desc.sc4desc': '',
			'SimCity 4/Plugins/360-landmark/diego-del-llano.432-park-avenue.dark.1.sc4pac/readme.txt': '',
			'SimCity 4/Plugins/360-landmark/diego-del-llano.one-world-trade-center.dark.1.sc4pac/nested/lot.dat': '',
			'SimCity 4/Plugins/200-residential/aaron-graham.wellington.dark.1.sc4pac/NYBT/desc.SC4Desc': '',
			'SimCity 4/Plugins/200-residential/aaron-graham.wellington.dark.1.sc4pac/NYBT/lot.SC4Lot': '',
			'SimCity 4/Plugins/200-residential/aaron-graham.wellington.dark.1.sc4pac/NYBT/model.SC4Model': '',
		}, '/');
		const fs = this.test.ctx.fs = createFsFromVolume(vol);
		this.test.ctx.scan = function(patterns = this.test.title, opts) {
			return new FileScanner(patterns, {
				fs,
				cwd: '/SimCity 4/Plugins',
				...opts,
			}).walkSync();
		};
	});

	it('diego-del-llano:*', function() {
		const files = this.scan();
		expect(files).to.have.length(3);
		for (let file of files) {
			expect(file).to.include('diego-del-llano.');
			expect(path.extname(file).toLowerCase()).to.be.oneOf(['.sc4lot', '.sc4desc', '.dat']);
		}
	});

	it('diego-del-llano:*/*.txt', function() {
		const files = this.scan();
		expect(files).to.have.length(1);
		expect(files[0]).to.include('readme.txt');
	});

	it('{diego-del-llano,aaron-graham}:*', function() {
		const files = this.scan();
		expect(files).to.have.length(6);
		for (let file of files) {
			expect(path.extname(file).toLowerCase()).to.be.oneOf(['.sc4lot', '.sc4desc', '.dat', '.sc4model']);
		}
	});

	it('360-landmark/**/*', function() {
		const files = this.scan();
		expect(files).to.have.length(3);
		for (let file of files) {
			expect(file).to.include('360-landmark');
			expect(path.extname(file).toLowerCase()).to.be.oneOf(['.sc4lot', '.sc4desc', '.dat']);
		}
	});

	it('360-landmark/**/*.txt', function() {
		const files = this.scan();
		expect(files).to.have.length(1);
		let [file] = files;
		expect(file).to.include('readme.txt');
	});

	it('*.dll', function() {
		const files = this.scan();
		expect(files).to.have.length(1);
		expect(files[0]).to.include('sc4fix.dll');
	});

	it(path.resolve('/SimCity 4/Plugins/075-my-plugins'), function() {
		const files = this.scan();
		expect(files).to.have.length(2);
	});

});
