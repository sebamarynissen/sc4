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
		ignores: [
			"lib/gui/**",
		],
	},
];
