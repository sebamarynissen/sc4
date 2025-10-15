// # pipe-manager-test.js
import PipeManager from '../pipe-manager.js';
import { Savegame } from 'sc4/core';
import { resource } from '#test/files.js';

describe('A pipe manager', function() {

	it('applies an optimal pipe layout', function() {
		let dbpf = new Savegame(resource('City - Small experiments.sc4'));
		let mgr = new PipeManager(dbpf);
		mgr.applyOptimalLayout();
	});

});
