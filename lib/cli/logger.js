// # logger.js
import chalk from 'chalk';

export default {
	ok: (...msg) => console.log(chalk.green('OK'), ...msg),
	error: (...msg) => console.log(chalk.red('ERROR'), ...msg),
	warn: (...msg) => console.log(chalk.yellow('WARNING'), ...msg),
	info: (...msg) => console.log(chalk.cyan('INFO'), ...msg),
	log: (...msg) => console.log(...msg),
};
