// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import jestPlugin from 'eslint-plugin-jest';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**/*', 'coverage/**/*', 'node_modules/**/*'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      jest: jestPlugin,
    },
    rules: {
      // General ESLint rules
      'no-console': 'error',

      // Jest rules
      'jest/no-focused-tests': 'error',
    },
  },
);
