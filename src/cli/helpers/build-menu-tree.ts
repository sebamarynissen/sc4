// # build-menu-tree.js
type MenuItem = {
	id: number;
	parent: number;
	name?: string;
};

type Node = {
	item: MenuItem;
	children: Node[];
};

// # buildMenuTrees(items)
// Builds up a menu tree - actually multiple ones, so that we can find the 
// orphans as well - from a flat array containing all nodes in the tree. Each 
// nodes specifies its parent node by id, and from this we can build up the 
// entire tree.
export default function buildMenuTree(items: MenuItem[]) {

	// First we'll populate the map with every 
	let childCache: Record<number, Node[]> = {};
	let index = new Map();
	for (let item of items) {
		let { id, parent } = item;
		let children = (childCache[id] ??= []);
		let node: Node = { item, children };
		index.set(id, node);
		(childCache[parent] ??= []).push(node);
	}

	// Now collect all root nodes by looping every node and check whether it has 
	// a parent or not.
	let roots: Node[] = [];
	for (let node of index.values()) {
		if (!index.has(node.item.parent)) {
			roots.push(node);
		}
	}
	return roots;

}
