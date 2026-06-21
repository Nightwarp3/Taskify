const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const projectRoot = __dirname
const sharedRoot = path.resolve(projectRoot, '../src/shared')

const config = getDefaultConfig(projectRoot)

// Allow Metro to resolve and watch the shared types living outside mobile/.
config.watchFolders = [sharedRoot]
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')]

module.exports = withNativeWind(config, { input: './global.css' })
