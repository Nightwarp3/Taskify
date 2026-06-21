module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel'
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            // Share the canonical data model with the desktop app.
            '@shared': '../src/shared'
          }
        }
      ],
      // react-native-reanimated/plugin must be listed last.
      'react-native-reanimated/plugin'
    ]
  }
}
