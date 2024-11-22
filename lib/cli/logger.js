// # logger.js
import chalk from 'chalk';

export default {
	ok: (...msg) => console.log(chalk.green('\rOK'), ...msg),
	error: (...msg) => console.log(chalk.red('\rERROR'), ...msg),
	warn: (...msg) => console.log(chalk.yellow('\rWARNING'), ...msg),
	info: (...msg) => console.log(chalk.cyan('\rINFO'), ...msg),
	log: (...msg) => console.log(...msg),
};
