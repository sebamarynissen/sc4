// # app.js
'use strict';
const path = require('path');
const electron = require('electron');
const { app, BrowserWindow } = electron;
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true;

app.on('ready', function() {
	let win = new BrowserWindow({
		width: 1920,
		height: 1080,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		}
	});
	let file = path.resolve(__dirname, 'index.html');
	win.loadURL(file);
	win.openDevTools();
});
