import '@testing-library/jest-dom';

// Test setup: increase timeout and any global test config
jest.setTimeout(30000);

// Mock window.matchMedia (required by Ant Design components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver (required by some Ant Design components)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock window.scrollTo
window.scrollTo = jest.fn();

// Mock window.getComputedStyle (required by rc-table scrollbar measurements)
window.getComputedStyle = jest.fn().mockImplementation(() => ({
  getPropertyValue: jest.fn().mockReturnValue(''),
  width: '0px',
  height: '0px',
})) as any;
