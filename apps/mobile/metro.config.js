const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// Two levels up: apps/mobile -> apps -> FinVault (monorepo root)
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Without this, Metro only watches apps/mobile/ and misses packages
// hoisted to the root node_modules by npm workspaces — causing native
// modules (expo-local-authentication, react-native-svg, etc.) to be
// found at JS-import time but NOT compiled into the native build,
// resulting in an instant crash on standalone APK.
config.watchFolders = [monorepoRoot];

// Tell the resolver to look in both the workspace and the monorepo root
// for node_modules so hoisted packages are always found.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
