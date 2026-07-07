module.exports = {
  overrides: [
    {
      files: ['lib/query/**/*.js'],
      rules: {
        'query/no-raw-feature-key': 'error',
      },
    },
  ],
};
