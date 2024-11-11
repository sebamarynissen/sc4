// # config.js
import Conf from 'conf';
import { parse, stringify } from 'yaml';

export default new Conf({
	projectName: 'sc4',
	fileExtension: 'yaml',
	deserialize: parse,
	serialize: stringify,
});
