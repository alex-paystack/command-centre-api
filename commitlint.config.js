// commitlint.config.js
/**
 * Commitlint configuration
 * @see https://commitlint.js.org/#/reference-configuration
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [2, 'always', 100],
    'header-max-length': [2, 'always', 72],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'type-enum': [
      2,
      'always',
      ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'],
    ],
  },
};
