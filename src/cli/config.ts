// # config.ts
import Conf from 'conf';
import { parse, Document, type YAMLSeq, type YAMLMap } from 'yaml';

type MenuConfig = {
	id: number;
	parent: number;
	name: string;
	order?: number;
};

export type Config = {
	folders?: {
		plugins?: string;
		installation?: string;
		regions?: string;
	};
	menus?: MenuConfig[];
};

// # serialize(config)
// This function is responsible for serializing the config file. Note that 
// instead of just serializing the yaml, we will make sure that some values are 
// stored as hex values, as that's more in line with the values people are used 
// to.
function serialize(config: Config) {
	let doc = new Document(config);
	let menus = doc.get('menus', true) as YAMLSeq<YAMLMap<MenuConfig>>;
	if (menus) {
		for (let obj of menus.items) {
			(obj.get('id', true) ?? {} as any).format = 'HEX';
			(obj.get('parent', true) ?? {} as any).format = 'HEX';
		}
	}
	return doc.toString();
}

const config = new Conf({
	projectName: 'sc4',
	fileExtension: 'yaml',
	deserialize: parse,
	serialize,
});
export default config;
