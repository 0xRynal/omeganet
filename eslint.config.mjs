import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
	{
		files: ["src/**/*.ts", "cli/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 2022,
				sourceType: "module",
				projectService: true,
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
		},
		rules: {
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-non-null-assertion": "error",
			"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/consistent-type-imports": [
				"error",
				{ prefer: "type-imports", fixStyle: "inline-type-imports" },
			],
			"@typescript-eslint/consistent-type-exports": "error",
			"@typescript-eslint/no-inferrable-types": "warn",
			"@typescript-eslint/no-misused-promises": "error",
			"@typescript-eslint/prefer-nullish-coalescing": "warn",
			"@typescript-eslint/prefer-optional-chain": "warn",
			"@typescript-eslint/no-unnecessary-type-assertion": "warn",
			"@typescript-eslint/no-import-type-side-effects": "error",
			"@typescript-eslint/switch-exhaustiveness-check": "error",
			"@typescript-eslint/no-redundant-type-constituents": "warn",
			"prefer-const": "error",
			"no-var": "error",
			"eqeqeq": ["error", "smart"],
		},
	},
	{
		ignores: ["out/**", "node_modules/**", "cli/dist/**", "**/*.js"],
	},
];
