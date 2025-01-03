// # new-submenu-command.js
import { createSubmenuButton } from 'sc4/submenus';
import logger from '#cli/logger.js';

type NewSubmenuOptions = {
	name: string;
	description?: string;
	parent: number;
	order: number;
};

// # newSubmenu(icon, options)
// The command to actually create a new submenu.
export async function newSubmenu(
	icon: Uint8Array,
	options: NewSubmenuOptions,
) {
	return await createSubmenuButton({
		logger,
		icon,
		save: true,
		...options,
	});
}
