module.exports = {
  extends: [require.resolve('code-fabric/eslint')],
  rules: {
    'max-classes-per-file': 0,
    'no-restricted-syntax': 0,
    '@typescript-eslint/method-signature-style': 0,
    '@typescript-eslint/ban-types': 0,
    'no-void': 0,
    'no-param-reassign': 0,
    '@typescript-eslint/no-unused-vars': 0,
  },
};
