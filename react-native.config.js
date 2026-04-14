const pkg = require('./package.json');

module.exports = {
  dependencies: {
    [pkg.name]: {
      root: __dirname,
      platforms: {
        ios: {},
        android: {},
      },
    },
  },
};
