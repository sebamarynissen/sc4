// # cli.js
"use strict";
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const program = require('commander');
const DBPF = require('../dbpf');

const Style = {
	"Chicago": 0x00002000,
	"New York": 0x00002001,
	"Houston": 0x00002002,
	"Euro": 0x00002003
};

// Main program options.
program
	.version('0.1.0');

// Some commands.
program
	.command('block [dir]')
	.action(function(dir) {

		if (!dir) {
			dir = process.cwd();
		}
		dir = path.resolve(process.cwd(), dir);

		let all = [];
		read(dir, function(file) {

			let name = path.basename(file);

			// Note: if the file starts with zzz_BLOCK_, skip it.
			if (name.match(/^zzz_BLOCK_/)) {
				return;
			}

			let dir = path.dirname(file);
			console.log(chalk.cyan('SCANNING'), chalk.gray(name));

			let buff = fs.readFileSync(file);
			let dbpf = new DBPF(buff);
			let shouldSave = false;
			for (let entry of dbpf.exemplars) {

				// Note: not parsing textual exemplars for now, but we should 
				// allow it later on! A parser should be written for it 
				// though...
				let exemplar = entry.read();
				for (let prop of exemplar.props) {
					
					// Look for the "OccupantGroups" property.
					if (prop.id === 0xAA1DD396) {
						chalk.gray('FOUND "OccupantGroups"');

						// Loop the values & set none of it.
						shouldSave = true;
						prop.value = prop.value.filter(function(style) {
							return !(Style.Chicago<=style&&style<=Style.Euro);
						});
						prop.value.push(0);

					}
				}
			}

			if (shouldSave) {
				let override = 'zzz_BLOCK_'+name;
				console.log(chalk.green('SAVING TO'), chalk.gray(override));
				override = path.join(dir, override);
				let buff = dbpf.toBuffer();
				fs.writeFileSync(override, buff);
			}
			

		});

	});

program.parse(process.argv);

// # read(dir, cb, recursive)
function read(dir, cb, recursive) {
	let list = fs.readdirSync(dir);
	for (let entry of list) {
		let full = path.join(dir, entry);
		let stat = fs.statSync(full);
		if (stat.isDirectory()) {
			if (recursive) {
				read(full, cb);
			}
		} else {
			cb(full);
		}
	}
}