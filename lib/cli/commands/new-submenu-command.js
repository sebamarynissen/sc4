// # new-submenu-command.js
import createSubmenuButton from 'sc4/api/create-submenu-button.js';
import logger from '#cli/logger.js';
import folders from '#cli/folders.js';

// # newSubmenu(icon, options)
// The command to actually create a new submenu.
export async function newSubmenu(icon, options) {
	let { directory = folders.plugins, ...rest } = options;
	return await createSubmenuButton({
		logger,
		icon,
		save: true,
		directory,
		...rest,
	});
}
