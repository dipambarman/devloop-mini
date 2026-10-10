/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  globalSetup: './tests/globalSetup.js',
  globalTeardown: './tests/globalTeardown.js',
};
