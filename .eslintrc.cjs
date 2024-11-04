module.exports = {
	extends: [
		"@whisthub",
	],
	overrides: [
		{
			files: ["dev/**"],
			rules: {
				"no-unused-vars": ["off"],
			},
		},
	],
};
