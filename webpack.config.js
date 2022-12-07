const path = require('path');

module.exports = {
	mode: 'development',
	devtool: false,
	entry: './main.js',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'main.js',
	},
	resolve: {
		fallback: {
			util: false,
			path: false,
			fs: false,
			crypto: false,
			buffer: require.resolve('buffer/'),
		},
	},
};
