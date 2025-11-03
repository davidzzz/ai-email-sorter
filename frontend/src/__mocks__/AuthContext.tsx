export const mockAuthContext = {
  isAuthenticated: true,
  user: { id: 'test-user-id', email: 'test@example.com', name: 'Test User' },
  login: jest.fn(),
  logout: jest.fn(),
  checkAuth: jest.fn(),
};
