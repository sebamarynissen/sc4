// # new-submenu-command.js
import createSubmenuButton from 'sc4/api/create-submenu-button.js';
import logger from '#cli/logger.js';

// # newSubmenu(icon, options)
// The command to actually create a new submenu.
export async function newSubmenu(icon, options) {
	return await createSubmenuButton({
		logger,
		icon,
		save: true,
		...options,
	});
}
