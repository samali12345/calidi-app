const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ignore macOS metadata files and other junk
config.resolver.blacklistRE = /.*\/\..*/;
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;
