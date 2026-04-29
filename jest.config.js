/**
 * Jest config dla Expo SDK 54 + React Native 0.81 + TanStack Query.
 * Faza 4 roadmapy -- pierwsze testy hookow z mockowanym Supabase.
 *
 * Preset jest-expo handluje:
 * - JSX transform przez babel-jest
 * - Mock react-native modules
 * - tsconfig paths (@/src/...) przez babel-plugin-module-resolver
 *
 * transformIgnorePatterns: nie ignoruj transform dla node_modules ktore
 * uzywaja ESM (Expo / RN modules musza byc transpilowane przez babel).
 */
module.exports = {
  preset: "jest-expo/node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@tanstack))",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/.expo/", "/android/", "/ios/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};
