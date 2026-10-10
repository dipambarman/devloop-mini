/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  setupFilesAfterEnv: ['./tests/setupAfterEnv.js'],
  testTimeout: 20000,
};
