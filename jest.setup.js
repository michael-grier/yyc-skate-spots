// Zero safe-area insets without needing a provider in every test; a minimal
// inline mock is all these tests consume from the library.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
