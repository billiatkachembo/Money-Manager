const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Get tsconfig paths
const tsConfig = require('./tsconfig.json');
const alias = {};

Object.entries(tsConfig.compilerOptions.paths).forEach(([key, [value]]) => {
  const aliasKey = key.replace('/*', '');
  const aliasValue = path.resolve(__dirname, value.replace('/*', ''));
  alias[aliasKey] = aliasValue;
});

config.resolver.alias = alias;

module.exports = config;
