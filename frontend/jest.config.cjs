module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/src/__mocks__/fileMock.js'
  },
  testTimeout: 30000,
  testMatch: ['**/__tests__/**/*.test.[tj]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
  globals: {
    'import.meta': {
      env: {
        VITE_API_URL: 'http://localhost:4000',
      },
    },
  },
};
