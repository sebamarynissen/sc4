// # victoria-test.js
const path = require('path');
const Savegame = require('../lib/savegame.js');

let city = new Savegame(path.resolve(__dirname, 'files/City - Victoria.sc4'));
let { lots } = city;
for (let lot of lots) {
	if (lot.minX === 2752/16 && lot.minZ === 3120/16) {
		lot.zoneWealth = 0x03;
		// console.log(lot);
	}
	// if (lot.zoneWealth === 0) {
	// 	console.log(lot);
	// }
}

city.save(path.resolve(__dirname, 'files/City - Victoria restored.sc4'));
