const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// zustand's ESM build uses import.meta, which Metro can't run; prefer CommonJS builds.
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = config;
