import config from '@whisthub/eslint-config/flat';

export default [
	config,
	{
		files: ["dev/**"],
		rules: {
			"no-unused-vars": ["off"],
		},
	},
	{
		rules: {
			"no-restricted-globals": [
				"error",
				"Buffer",
			],
		},
	},
	{
		ignores: [
			"lib/gui/**",
		],
	},
];
