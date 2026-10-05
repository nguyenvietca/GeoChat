// Mock for react-native Platform module used in chatWebSocketService
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: { ...RN.Platform, OS: 'ios' },
  };
});
