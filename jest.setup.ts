/**
 * Jest setup -- wczytywany po kazdym test file.
 * Faza 4 roadmapy.
 */
import "@testing-library/jest-native/extend-expect";

// Mock react-native-reanimated -- wymagany dla testow uzywajacych Animated API
// (np. MobilePlanZoomView). Bez tego: "Reanimated worklet must be initialized..."
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

// Wyciszenie console.error/warn z RN podczas testow (chyba ze test sprawdza logi).
// Globalne -- mozna nadpisac per-test przez jest.spyOn.
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
