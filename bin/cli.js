#!/usr/bin/env node
"use strict";
const stream = require('stream');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const ini = require('ini');
const tar = require('tar');
const ora = require('ora');
const program = require('commander');
const inquirer = require('inquirer');
const DBPF = require('../lib/dbpf');
const Savegame = require('../lib/savegame');
const FileType = require('../lib/file-types');
const pkg = require('../package.json');
const { ZoneType } = require('../lib/enums');

const Style = {
	"Chicago": 0x00002000,
	"NewYork": 0x00002001,
	"Houston": 0x00002002,
	"Euro": 0x00002003
};

// Main program options.
program
	.name('sc4')
	.version(pkg.version);

program
	.command('historical <city>')
	.description('Make buildings within the given city historical')
	// .option('--force', 'Force override of the city')
	// .option('-o, --output', 'The output path to store the city if you\'re not force-overriding')
	.action(async function(city) {
		
		// Apparently if someone accidentally uses the command wrong and types 
		// "--force city-name", things go terribly wrong. The command starts 
		// executing and creates a new readable stream, but apparently on the 
		// next tick it decides that the syntax was incorrect and just force 
		// terminates the program, resulting in an empty file that was 
		// force-overwritten. That's a BIG thing, but we can solve this by 
		// only starting the command on the next tick, which can be force by 
		// Promise.resolve().
		await Promise.resolve();

		let dir = process.cwd();
		let file = path.resolve(dir, city);
		let ext = path.extname(file);
		if (ext !== '.sc4' || !fs.existsSync(file)) {
			return err(`${file} is not a SimCity 4 savegame!`);
		}

		// Fire up inquirer for an interactive interface.
		let answers = await inquirer.prompt([{
			"type": "checkbox",
			"name": "types",
			"message": "What type of buildings do you want to make historical?",
			"default": ["Residential", "Commercial", "Agricultural", "Industrial"],
			"choices": ["Residential", "Commercial", "Agricultural", "Industrial"]
		}, {
			"name": "force",
			"type": "confirm",
			"message": [
				`Do you want to override "${path.basename(city)}"?`,
				chalk.yellow(`Don't do this if you have no backup yet!`.toUpperCase())
			].join(' '),
			"default": false
		}, {
			"name": "output",
			"type": "input",
			"message": [
				`Where should I save your city?`,
				`Path is relative to "${dir}".`
			].join(' '),
			"default": 'HISTORICAL-'+path.basename(city),
			when(answers) {
				return !answers.force;
			},
			validate(answer) {
				return Boolean(answer.trim());
			}
		}, {
			"name": "ok",
			"type": "confirm",
			"default": true,
			message(answers) {
				let out = path.resolve(dir, answers.output);
				return `Saving to "${out}", is that ok?`;
			},
			when(answers) {
				return answers.hasOwnProperty('output');
			}
		}]);

		// Not ok? Exit.
		if (!answers.force && !answers.ok) return;

		// Parse answers.
		answers.types.map(type => this[type.toLowerCase()] = true);
		this.force = answers.force;

		// Parse the output path.
		let out;
		if (this.force) {
			out = file;
		} else {
			out = path.resolve(dir, answers.output);
		}

		// Read in the city.
		console.log(chalk.cyan('READING'), file);
		let buff = fs.readFileSync(file);
		let dbpf = new Savegame(buff);

		// // Find the lotfile entry.
		let lotFile = dbpf.lotFile;
		if (!lotFile) {
			return err('No lots found in this city!');
		}
		
		// Loop the lots & make historical.
		let i = 0;
		for (let lot of lotFile) {
			if (lot.historical) continue;
			if (
				(this.residential && lot.isResidential) ||
				(this.commercial && lot.isCommercial) ||
				(this.agricultural && lot.isAgricultural) ||
				(this.industrial && lot.isIndustrial)
			) {
				i++;
				lot.historical = true;
			}
		}

		// No lots found? Don't re-save.
		if (i === 0) {
			return warn('No lots fond to make historical!');
		}

		// Log.
		ok(chalk.gray(`Marked ${i} lots as historical.`));

		// Save again.
		console.log(chalk.cyan('SAVING'), out);
		await dbpf.save({"file": out});
		return ok('Done');

	});

program
	.command('growify <city>')
	.description('Convert plopped buildings into functional growables')
	// .description('Convert all plopped Residential buildings to growables')
	// .option('-i, --interactive', 'Interactively define the growify options')
	// .option('--force', 'Force override of the city')
	// .option('-z, --zone-type <type>', 'The zone type to be set. Defaults to Residential - High (R3). Use R1, R2, or R3')
	// .option('-o, --output', 'The output path to store the city if you\'re not force-overriding')
	.action(async function(city) {

		// Same story here. See historical command.
		await Promise.resolve();

		// Ensure that the city exists first.
		let dir = process.cwd();
		let file = path.resolve(dir, city);
		let ext = path.extname(file);
		if (ext !== '.sc4' || !fs.existsSync(file)) {
			return err(`${file} is not A SimCity 4 savegame!`);
		}

		// For now we're going interactive by default. Perhaps we can change 
		// this again later if we want to write scripts that automate the 
		// tasks, but for now it's better this way. Doesn't take too long to 
		// fill in anyway.
		let answers = await inquirer.prompt([{
			"name": "filter",
			"type": "checkbox",
			"message": "What type(s) of buildings do you want to growify?",
			"default": ["Residential", "Industrial", "Agricultural"],
			"choices": [{
				"name": "Residential buildings",
				"value": "Residential"
			}, {
				"name": "Industrial buildings",
				"value": "Industrial"
			}, {
				"name": "Agricultural buildings",
				"value": "Agricultural"
			}]
		}, {
			"name": "RZoneType",
			"type": "list",
			"message": "What zone should the residential buildings become?",
			"default": 2,
			"choices": [{
				"name": "Low Density",
				"value": ZoneType.RLow
			}, {
				"name": "Medium Density",
				"value": ZoneType.RMedium
			}, {
				"name": "High Density",
				"value": ZoneType.RHigh
			}],
			when(answers) {
				return answers.filter.includes('Residential');
			}
		}, {
			"name": "IZoneType",
			"type": "list",
			"message": "What zone should the industrial buildings become?",
			"default": 1,
			"choices": [{
				"name": "Medium Density",
				"value": ZoneType.IMedium
			}, {
				"name": "High Density",
				"value": ZoneType.IHigh
			}],
			when(answers) {
				return answers.filter.includes('Industrial');
			}
		}, {
			"name": "force",
			"type": "confirm",
			"message": [
				`Do you want to override "${path.basename(city)}"?`,
				chalk.yellow(`Don't do this if you have no backup yet!`.toUpperCase())
			].join(' '),
			"default": false,
			when(answers) {
				return answers.filter.length > 0;
			}
		}, {
			"name": "output",
			"type": "input",
			"message": [
				`Where should I save your city?`,
				`Path is relative to "${dir}".`
			].join(' '),
			"default": 'GROWIFIED-'+path.basename(city),
			when(answers) {
				return answers.filter.length > 0 && !answers.force;
			},
			validate(answer) {
				return Boolean(answer.trim());
			}
		}, {
			"name": "ok",
			"type": "confirm",
			"default": true,
			message(answers) {
				let out = path.resolve(dir, answers.output);
				return `Saving to "${out}", is that ok?`;
			},
			when(answers) {
				return answers.hasOwnProperty('output');
			}
		}]);

		// Not ok? Exit.
		if (!answers.force && !answers.ok) return;

		// Put the answers in the options.
		answers.filter.map(type => this[type.toLowerCase()] = true);
		if (this.residential) {
			this.residential = answers.RZoneType;
		}
		if (this.industrial) {
			this.industrial = answers.IZoneType;
		}
		if (this.agricultural) {
			this.agricultural = ZoneType.ILow;
		}
		this.force = answers.force;

		// Parse the output path.
		let out;
		if (this.force) {
			out = file;
		} else {
			out = path.resolve(dir, answers.output);
		}

		// Read in the city.
		console.log(chalk.cyan('READING'), file);
		let buff = fs.readFileSync(file);
		let dbpf = new Savegame(buff);

		// Find the lotfile entry.
		let lotFile = dbpf.lotFile;
		if (!lotFile) {
			return err('No lots in this city!');
		}

		// Loop all lots & check for plopped residential or industrial.
		let rCount = 0, iCount = 0, aCount = 0;
		for (let lot of lotFile) {
			if (this.residential && lot.isPloppedResidential) {
				lot.zoneType = this.residential;
				rCount++;
			} else if (this.industrial && lot.isPloppedIndustrial) {

				// Check for agricultural plops.
				lot.zoneType = this.industrial;
				iCount++;

			} else if (this.agricultural && lot.isPloppedAgricultural) {
				lot.zoneType = this.agricultural;
				aCount++;
			}
		}

		// If no plopped buildings were found, exit.
		if (rCount + iCount === 0) {
			return warn('No plopped buildings found to growify!');
		}

		ok(`Growified ${rCount} residentials, ${iCount} industrials & ${aCount} agriculturals`);

		// Save.
		console.log(chalk.cyan('SAVING'), out);
		await dbpf.save({"file": out});
		return ok('Done');

	});

// Some commands.
program
	.command('tileset [dir]')
	.description('Set the tilesets for all buildings in the given directory')
	.option('-b, --block', 'Block all buildings from growing')
	.option('-C, --chicago', 'Set the Chicago tileset for all buildings')
	.option('-N, --ny', 'Set the New York tileset for all buildings')
	.option('-H, --houston', 'Set the Houston tileset for all buildings')
	.option('-E, --euro', 'Set the Euro tileset for all buildings')
	.option('-r, --recursive', 'Scan directories recursively')
	.action(function(dir) {

		let start = new Date();

		if (!dir) {
			dir = process.cwd();
		}
		dir = path.resolve(process.cwd(), dir);

		// Check which tilesets need to be set.
		let sets = [];
		if (this.block) {
			sets.push(0);
		} else  {
			if (this.chicago) sets.push(Style.Chicago);
			if (this.ny) sets.push(Style.NewYork);
			if (this.houston) sets.push(Style.Houston);
			if (this.euro) sets.push(Style.Euro);

			// Ensure that at least 1 tileset has been given.
			if (sets.length === 0) {
				err('You must specify at least 1 tileset! Use --chicago, --ny, --houston and --euro, or use --block to block the buildings from growing!');
				return;
			}

		}

		console.log(chalk.green('SCANNING IN'), dir, chalk.cyan('RECURSIVE?'), !!this.recursive);

		let all = [];
		read(dir, function(file) {

			let name = path.basename(file);

			// Note: if the file starts with zzz_BLOCK_, skip it.
			if (name.match(/^zzz_BLOCK_/)) {
				return;
			}

			let dir = path.dirname(file);
			let buff = fs.readFileSync(file);

			// Check the first 4 bytes. Should be DBPF, otherwise no point in 
			// reading it.
			if (buff.toString('utf8', 0, 4) !== 'DBPF') return;

			console.log(chalk.cyan('SCANNING'), chalk.gray(name));
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

						// Filter out any existing styles.
						shouldSave = true;
						prop.value = prop.value.filter(function(style) {
							return !(Style.Chicago<=style&&style<=Style.Euro);
						});

						// Push in the new styles.
						prop.value.push(...sets);

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
			

		}, !!this.recursive);

		let time = new Date() - start;
		console.log(chalk.green('DONE'), chalk.gray('('+time+'ms)'));

	});

// Backup command for backup a region or a plugins folder.
program
	.command('backup')
	.description('Backup a region or your entire plugins folder')
	.option('-R, --region <name>', 'The name of the region to be backuped, or the path to the region\'s directory')
	.option('-P, --plugins [dir]', 'Set this flag if you want to backup your plugins')
	.option('-o, --output [dir]', 'Specify the path to the output directory. Defaults to Current Working Directory.')
	.action(async function() {

		// Find the user's home directory.
		const home = process.env.HOMEPATH;
		const docs = path.join(home, 'documents/SimCity 4');
		
		// Check if either plugins or region was specified.
		if (!this.region && !this.plugins) {
			err('Either specify a region or plugin folder using the --region & --plugins options');
		}

		// Check if a region needs to be backuped.
		if (this.region) {
			let region = this.region;
			let folder;
			if (region === '.') {
				folder = process.cwd();
			} else {
				folder = path.resolve(path.join(docs, 'regions'), region);
			}
			
			// Ensure that the folder exists.
			if (!fs.existsSync(folder)) {
				err(`The region seems not to exist. Looked for "${folder}". You can specify the full path if you want.`);
				return;
			}

			// Okay, region exists. Read the entire directory **recursively** 
			// and add all files.
			let files = [];
			read(folder, function(file) {
				let ext = path.extname(file);
				if (!ext.match(/(\.sc4)|(\.bmp)|(\.png)|(\.ini)/)) return;
				files.push(path.relative(folder, file));
			}, true);

			// Add the region.ini file manually because we'll override it.
			let date = getDateSuffix();
			// let iniFile = path.resolve(folder, 'region.ini');
			// if (!fs.existsSync(iniFile)) {
			// 	return err('No region.ini found!');
			// }
			// let settings = ini.decode(String(fs.readFileSync(iniFile)));
			// settings['Regional Settings'].Name += ' - '+date;
			// let iniString = ini.encode(settings);
			// let rs = new stream.Readable({
			// 	read() {
			// 		this.push(iniString);
			// 		this.push(null);
			// 	}
			// });
			// files.push(rs);

			// Parse the output path.
			let out = this.output;
			if (!out) {
				out = process.cwd();
			} else {
				out = path.resolve(process.cwd(), out);
			}

			let suffix = date + '.tar.gz';
			let name = path.basename(folder);
			out = path.resolve(out, [name, suffix].join(' - '));

			// If the output directory is the region folder itself, log a 
			// warning as this is not recommended.
			if (path.dirname(out).toLowerCase() === folder.toLowerCase()) {
				warn('You are backuping your region inside the region\'s own folder! This is not recommended! Make sure to move the backup somewhere else!');
			}

			// Create a tar-stream from the entire directory.
			let ws = tar.create({
				"gzip": true,
				"cwd": folder
			}, files).pipe(fs.createWriteStream(out));

			// Show a spinner.
			let spinner = ora();
			spinner.stream = process.stdout;
			spinner.start(`Backing up region "${name}"...`);

			await new Promise(resolve => {
				ws.on('finish', () => resolve());
			});

			spinner.stop();
			ok(`Region ${name} backuped to "${out}"`);

		}

		// Check for the plugins folder as well.
		if (this.plugins) {
			let folder;
			if (this.plugins === true) {
				folder = path.join(docs, 'Plugins');
			} else {
				folder = path.resolve(process.cwd(), this.plugins);
			}

			// Ensure that the plugins folder exists.
			if (!fs.existsSync(folder)) {
				err(`The plugins folder ${folder} does not exist!`);
			}

			// Find the output folder.
			let out = this.output;
			if (!out) {
				out = process.cwd();
			} else {
				out = path.resolve(process.cwd(), out);
			}

			// Ensure that the output folder exists.
			if (!fs.existsSync(out)) {
				return err(`The destination folder ${out} does not exist!`);
			}

			let suffix = getDateSuffix() + '.tar.gz';
			out = path.resolve(out, ['Plugins', suffix].join(' - '));

			// Create a spinner because this can take some time.
			let spinner = ora();
			spinner.stream = process.stdout;
			spinner.start(`Backing up plugins...`);

			let ws = tar.create({
				"gzip": true,
				"cwd": path.dirname(folder)
			}, [path.basename(folder)]).pipe(fs.createWriteStream(out));

			await new Promise(resolve => {
				ws.on('finish', () => resolve());
			});

			spinner.stop();
			ok(`Plugins backuped to "${out}"`);

		}

		// We're done.
		ok('Done');

	});

program.parse(process.argv);

// Display help by default.
if (program.args.length === 0) {
	program.help();
}

// # read(dir, cb, recursive)
function read(dir, cb, recursive) {

	let stat = fs.statSync(dir);
	if (!stat.isDirectory()) {
		cb(dir);
		return;
	}

	let list = fs.readdirSync(dir);
	for (let entry of list) {
		let full = path.join(dir, entry);
		let stat = fs.statSync(full);
		if (stat.isDirectory()) {
			if (recursive) {
				read(full, cb, recursive);
			}
		} else {
			cb(full);
		}
	}
}

function ok(msg) {
	console.log(chalk.green('OK'), msg);
}

function err(msg) {
	console.log(chalk.red('ERROR'), chalk.red(msg));
}

function warn(msg) {
	console.log(chalk.yellow('WARNING'), chalk.yellow(msg));
}

function getDateSuffix() {
	let date = new Date();
	let day = [
		date.getFullYear(),
		String(date.getMonth()).padStart(2, '0'),
		String(date.getDay()).padStart(2, '0')
	].join('-');
	
	let time = [
		String(date.getHours()).padStart(2, '0'),
		String(date.getMinutes()).padStart(2, '0'),
		String(date.getSeconds()).padStart(2, '0')
	].join('.');
	return [day, time].join(' ');
}