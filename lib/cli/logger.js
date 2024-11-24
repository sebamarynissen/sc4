// # logger.js
import chalk from 'chalk';
import ora from 'ora';

let spinner;
let prefix = '';
export default {
	ok: (...msg) => console.log(chalk.green(`${prefix}OK`), ...msg),
	error: (...msg) => console.log(chalk.red(`${prefix}ERROR`), ...msg),
	warn: (...msg) => console.log(chalk.yellow(`${prefix}WARNING`), ...msg),
	info: (...msg) => console.log(chalk.cyan(`${prefix}INFO`), ...msg),
	log: (...msg) => console.log(...msg),
	step(text) {
		spinner = ora(text).start();
		prefix = '\r';
	},
	progress: text => void (spinner.text = text),
	succeed: text => {
		spinner.succeed(text);
		prefix = '';
	},
	fail: text => {
		spinner.fail(text);
		prefix = '';
	},
};
