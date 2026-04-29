/**
 * Babel config dla Jest (testy) + Expo (dev/build).
 * Faza 4 roadmapy.
 *
 * Bez tego pliku Jest nie wie jak transformowac TS -- aplikacja sama
 * uzywa SWC przez Metro w runtime, ale jest-expo wymaga babel.
 *
 * babel-preset-expo: standardowy preset Expo SDK 54 -- handluje:
 * - TypeScript + JSX
 * - React Native runtime
 * - Reanimated worklets
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
