import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import chalk from 'chalk';
import tar from 'tar';
import ora from 'ora';
import { program as commander, Command } from 'commander';
import * as commands from '#cli/commands';
import { DBPF, FileType } from 'sc4/core';
import * as api from 'sc4/api';
import { hex } from 'sc4/utils';
import * as parsers from './parsers.js';
import version from './version.js';

const Style = {
	Chicago: 0x00002000,
	NewYork: 0x00002001,
	Houston: 0x00002002,
	Euro: 0x00002003,
};

// Define getters for the api & cwd on the command's prototype which default 
// to going back up to the main program.
const $cwd$ = Symbol('cwd');
const $api$ = Symbol('api');
Object.defineProperties(Command.prototype, {
	api: {
		get() { return root(this)[$api$]; },
		set(api) { root(this)[$api$] = api; },
	},
	cwd: {
		get() { return root(this)[$cwd$]; },
		set(cwd) { root(this)[$cwd$] = cwd; },
	},
});

// # factory(program)
// A factory function that decorates a new commander instance. We need this 
// because for every unit test we need to create a new commander instance, 
// otherwise global state is shared between tests which is a big no no. Have a 
// look at https://github.com/tj/commander.js/issues/438.
export function factory(program) {

	// Main program options.
	program
		.name('sc4')
		.version(version)
		.description([
			`${chalk.magentaBright('sc4')} is a cli utility to modify .sc4 savegames and perform various modding tasks.`,
			'You can use the individual commands listed below, or just run sc4 without any commands to get an interactive interface.',
			`Run ${chalk.cyan('sc4 [command] --help')} to view all options for the individual commands.`,
		].join('\n'))
		.action(commands.interactive);

	const city = program
		.command('city')
		.description(`Modify savegames. Run ${chalk.magentaBright('sc4 city')} to view all available commands`);

	city
		.command('historical <city>')
		.description('Make buildings within the given city historical')
		.option('-o, --output <out>', 'The output path to store the city if you\'re not force-overriding')
		.option('-a, --all', 'Make all buildings historical')
		.option('-r, --residential', 'Make all residential buildings historical')
		.option('-c, --commercial', 'Make all commercial buildings historical')
		.option('-i, --industrial', 'Make all industrial buildings historical')
		.option('-g, --agricultural', 'Make all agricultural buildings historical')
		.action(commands.historical);

	city
		.command('growify <city>')
		.description('Convert plopped buildings into functional growables')
		.option('-o, --output <out>', 'The output path to store the city. Overrides the file by default')
		.option('-r, --residential <type>', 'Zone type of the residential buildings to growify (Low, Medium, High)')
		.option('-c, --commercial <type>', 'Zone type of the commercial buildings to growify (Low, Medium, High)')
		.option('-i, --industrial <type>', 'Zone type of the industrial buildings to growify (Medium, High)')
		.option('-g, --agricultural', 'Whether or not to growify agricultural buildings as well')
		.option('--no-historical', 'Don\'t make the growified lots historical')
		.action(commands.growify);

	// Command for generating the optimal pipe layout in a city.
	city
		.command('pipes <city>')
		.description('Create the optimal pipe layout in the given city')
		.action(commands.pipes);

	// Command for plopping all lots from a folder in a city.
	city
		.command('plop <city> [patterns...]')
		.description(`Plops all lots that match the patterns in the city. DO NOT use this on established cities!`)
		.option('--bbox <bbox>', 'The bounding box to plop the lots in, given as minX,minZ,maxX,maxZ. Defaults to the entire city.')
		.option('--clear', 'Clears the existing lots in the city')
		.option('-d, --directory <dir>', 'The directory to match the patterns against. Defaults to you configured plugins folder')
		.option('--random [seed]', 'Plops the lots in random order, optionally with a seed for reproducability')
		.action(commands.plopAll);

	// Command for looking for refs.
	city
		.command('refs <city>')
		.description('Lists all subfiles where the given pointer address or pointer type is referenced')
		.option('--address <ref>', 'A specific memory reference to look for')
		.option('--type <type>', 'The Type IDs for which we need to look for references')
		.action(commands.cityRefs);

	city
		.command('pointer <city> <pointer>')
		.description('Finds the subfile entry addressed by the given pointer')
		.action(commands.cityPointer);

	const submenu = program
		.command('submenu')
		.description(`Manage submenus. Run ${chalk.magentaBright('sc4 submenu')} to list available commands`);

	submenu
		.command('create')
		.description('Generates a new submenu button')
		.argument('<icon>', 'The path to the png icon to use')
		.requiredOption('--name', 'The name of the submenu as it appears in the game')
		.option('--description', 'The description of the submenu in the game')
		.requiredOption('--parent', 'The parent submenu button ID. e.g. 0xce21dbeb for sports grounds')
		.option('--button', 'The button id to use. By default a random button id is created')
		.option('-o, --output [file]', 'Path to the output file. Defaults to a path based on the name of the submenu')
		.option('-d, --directory [dir]', 'The directory where the output path will be relative to. Defaults to your plugins folder')
		.action(commands.newSubmenu);

	submenu
		.command('add')
		.description('Adds all specified lots to the given menu using the Exemplar Patching method')
		.argument('[files...]', 'The files or directories to scan. Can also be a glob pattern. Defaults to the current working directory')
		.requiredOption('-m, --menu [button id]', 'The button ID of the submenu, e.g. 0x83E040BB for highway signage.')
		.option('-o, --output [file]', 'Path to the output file. Defaults to "Submenu patch.dat".')
		.option('-d, --directory [dir]', 'The directory where the files are located. Defaults to current work directory')
		.option('--instance [IID]', 'The instance id (IID) to use for the patch, random by default.')
		.option('-r, --recursive', 'Whether to scan any folders specified recursively. Defaults to false')
		.action(commands.submenu);

	submenu
		.command('scan [folder]')
		.description('Scans the given folder for any submenus and adds them to the config file. Uses your configured plugin folder by default')
		.action(commands.scanForMenus);

	submenu
		.command('unpack')
		.argument('[dir]', 'The directory where the submenus to unpack are located. Defaults to the current working directory')
		.description('Unpacks all in a given directory for use in github.com/sebamarynissen/sc4-submenu-collection')
		.option('-p, --patterns [patterns...]', 'A list of glob patterns that define the submenus to match. Defaults to **/*.dat')
		.option('-o, --output [dir]', 'Path to the output directory. Defaults to the current working directory')
		.action(commands.submenuUnpack);

	// Subcommand for plugin-related functionalities
	const plugins = program
		.command('plugins')
		.description(`Manage plugins. Run ${chalk.magentaBright('sc4 plugins')} to list available commands`);

	// Command for tracking dependencies.
	plugins
		.command('track [patterns...]')
		.description('Finds all dependencies for the files that match the given patterns')
		.option('-d, --directory <dir>', 'The directory to match the patterns against. Defaults to your configured plugins folder')
		.option('--tree', 'Shows the entire dependency tree')
		.action(commands.track);

	// Commands that operate specifically on dbpfs, such as extracting a DBPF.
	const dbpf = program
		.command('dbpf')
		.description(`Operate on DBPF files. Run ${chalk.magentaBright('sc4 dbpf')} to list available commands`);

	dbpf
		.command('extract')
		.description('Extracts the contents of one or more DBPF files')
		.argument('<dbpf...>', 'Glob pattern(s) of DBPF files to match, e.g. **/*.{sc4lot,dat}')
		.option('-t, --type <type>', 'Only extract files with the given TypeID (e.g. png, 0x6534284A)', parsers.typeId)
		.option('-g, --group <group>', 'Only extract files with the given GroupID (e.g. 0x123006aa)', parsers.number)
		.option('-i, --instance <instance>', 'Only extract files with the given InstanceID (e.g. 0x00003000)', parsers.number)
		.option('-f, --force', 'Force overwriting existing output files')
		.option('-o, --output <directory>', 'Output directory. Defaults to the current working directory')
		.option('--yaml', 'Extract exemplars & cohorts as yaml')
		.option('--no-tgi', 'Skips creating .TGI files')
		.action(commands.dbpfExtract);

	// There are several commands that we have implemented, but they need to be 
	// reworked. We'll put thos under the "misc" category and instruct users not 
	// to use them, or at least with care.
	const misc = program
		.command('misc')
		.description('Contains various commands that are experimental and not officially supported. Be very careful when using them!');

	// Command for comparing
	misc
		.command('dump <city>')
		.storeOptionsAsProperties()
		.description('Give a human-readable representation of all lots in the city')
		.action(function(city) {

			let dir = this.cwd;
			let file = path.resolve(dir, city);
			let buff = fs.readFileSync(file);
			
			let dword = 'crc mem IID dateCreated buildingIID linkedIndustrial linkedAgricultural demandSourceIndex name unknown0'.split(' ');
			let word = 'unknown6'.split(' ');
			let byte = 'flag1 flag2 flag3 zoneType zoneWealth unknown5 orientation type debug'.split(' ');
			function replacer(name, val) {
				if (name === 'commuteBuffer') return val ? '...' : null;
				else if (dword.includes(name)) return hex(val);
				else if (byte.includes(name)) return hex(val, 2);
				else if (word.includes(name)) return hex(val, 4);
				else return val;
			}

			let dbpf = new DBPF(buff);
			let lots = dbpf.find({ type: FileType.Lot }).read();
			let all = [];
			for (let lot of lots) {
				let str = JSON.stringify(lot, replacer, 2);
				all.push(str);
			}
			console.log(all.join('\n\n-----------------\n\n'));

		});

	// Some commands.
	misc
		.command('tileset [dir]')
		.storeOptionsAsProperties()
		.description('Set the tilesets for all buildings in the given directory')
		.option('-b, --block', 'Block all buildings from growing')
		.option('-C, --chicago', 'Set the Chicago tileset for all buildings')
		.option('-N, --ny', 'Set the New York tileset for all buildings')
		.option('-H, --houston', 'Set the Houston tileset for all buildings')
		.option('-E, --euro', 'Set the Euro tileset for all buildings')
		.option('-r, --recursive', 'Scan directories recursively')
		.option('--force', 'Force override the files')
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

			const force = this.force;
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
					let override = force ? name : 'zzz_BLOCK_'+name;
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
	misc
		.command('backup')
		.storeOptionsAsProperties()
		.description('Backup a region or your entire plugins folder')
		.option('-R, --region <name>', 'The name of the region to be backuped, or the path to the region\'s directory')
		.option('-P, --plugins [dir]', 'Set this flag if you want to backup your plugins')
		.option('-o, --output [dir]', 'Specify the path to the output directory. Defaults to Current Working Directory.')
		.action(async function() {

			// Find the user's home directory.
			const home = os.homedir();
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
					if (!ext.match(/(\.sc4)|(\.bmp)|(\.png)|(\.ini)/i)) return;
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
					gzip: true,
					cwd: folder,
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
					gzip: true,
					cwd: path.dirname(folder),
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

	// Command for switching the active tilesets in a city.
	misc
		.command('tracts <city>')
		.storeOptionsAsProperties()
		.option('-t, --tilesets <tilesets>', 'The tileset identifiers, given as numbers')
		.option('-y, --years <years>', 'The amount of years in the cycle')
		.option('--force', 'Force override the city')
		.description('Changes the active tilesets in the given city')
		.action(async function(city) {
			let dir = this.cwd;
			let file = path.resolve(dir, city);
			let buff = fs.readFileSync(file);
			let dbpf = new DBPF(buff);

			let entry = dbpf.entries.find(entry => entry.type === FileType.TractDeveloper);
			let tracts = entry.read();
			if (!this.tilesets) {
				throw new Error('No tilesets specified!');
			}

			// Parse the tilesets.
			let styles = [];
			for (let style of this.tilesets.split(',')) {
				styles.push(+style);
			}
			tracts.styles = styles;

			if (this.years) {
				tracts.years = +this.years;
			}

			// Save.
			let opts = baseOptions();
			let output = file;
			if (!this.force) {
				let dir = path.dirname(file);
				let name = 'TRACTS_'+path.basename(file);
				output = path.join(dir, name);
			}
			opts.info(`Saving to ${ output }`);
			await dbpf.save({ file: output });

		});

	// Command for finding duplicate files in a plugin folder.
	misc
		.command('duplicates <folder>')
		.storeOptionsAsProperties()
		.action(function(folder) {
			api.duplicates({
				...baseOptions(),
				folder,
			});
		});

	const config = program
		.command('config')
		.description(`Manage sc4 configuration. Run ${chalk.magentaBright('sc4 config')} to list available commands`);

	// Command for opening the config file.
	config
		.command('edit')
		.description(`Allows editing the config file manually. Be careful with this if you don't know what you're doing!`)
		.action(commands.config);

	// End of factory function.
	return program;

}

// # root(cmd)
// Finds the root command of a given command.
function root(cmd) {
	while (cmd.parent) cmd = cmd.parent;
	return cmd;
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

function baseOptions() {
	return { info, ok, warn, error: err };
}

function ok(...msg) {
	console.log(chalk.green('OK'), ...msg);
}

function err(...msg) {
	console.log(chalk.red('ERROR'), ...msg);
}

function warn(...msg) {
	console.log(chalk.yellow('WARNING'), ...msg);
}

function info(...msg) {
	console.log(chalk.cyan('INFO'), ...msg);
}

function getDateSuffix() {
	let date = new Date();
	let day = [
		date.getFullYear(),
		String(date.getMonth()).padStart(2, '0'),
		String(date.getDay()).padStart(2, '0'),
	].join('-');
	
	let time = [
		String(date.getHours()).padStart(2, '0'),
		String(date.getMinutes()).padStart(2, '0'),
		String(date.getSeconds()).padStart(2, '0'),
	].join('.');
	return [day, time].join(' ');
}

export default function setup(program = commander) {

	// Set up all options first.
	factory(program);

	// Set the default api & cwd to be used.
	program.api = api;
	program.cwd = process.cwd();
	return program;

}
