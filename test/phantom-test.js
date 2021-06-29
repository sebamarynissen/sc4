// # phantom-test.js
'use strict';
const path = require('path');
const Savegame = require('../lib/savegame.js');

describe('A phantom affected city', function() {

	it('reads line item file', function() {

		let file = path.resolve(__dirname, 'files/City - Phantom.sc4');
		let dbpf = new Savegame(file);

		let items = dbpf.lineItems;
		for (let lot of dbpf.lots) {
			console.log(lot.sgprops);
		}

	});

});
