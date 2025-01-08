// # logger.js
import chalk from 'chalk';
import ora, { type Ora } from 'ora';

let spinner: Ora;
let prefix = '';
export default {
	ok: (...msg: any[]) => console.log(chalk.green(`${prefix}OK`), ...msg),
	error: (...msg: any[]) => console.log(chalk.red(`${prefix}ERROR`), ...msg),
	warn: (...msg: any[]) => console.log(chalk.yellow(`${prefix}WARNING`), ...msg),
	info: (...msg: any[]) => console.log(chalk.cyan(`${prefix}INFO`), ...msg),
	log: (...msg: any[]) => console.log(...msg),
	progress: {
		start(text: string) {
			spinner = ora(text).start();
			prefix = '\r';
		},
		update: (text: string) => void (spinner.text = text),
		succeed: (text: string) => {
			spinner.succeed(text);
			prefix = '';
		},
		fail: (text: string) => {
			spinner.fail(text);
			prefix = '';
		},
		warn: (text: string) => {
			spinner.warn(text);
			prefix = '';
		},
	},
};
