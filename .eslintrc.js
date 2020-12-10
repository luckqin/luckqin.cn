module.exports = {
  root: true,
  extends: ['eslint-config-fespsp'],
  overrides: [
    {
      files: ['*.js'],
      extends: [require.resolve('eslint-config-fespsp/rules/react')],
      rules: {
        'react/no-unescaped-entities': 0,
        'react/prop-types': 0,
      },
    },
  ],
  globals: {
    __PATH_PREFIX__: true,
    process: true,
  },
};
