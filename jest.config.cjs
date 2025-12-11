module.exports = {
  moduleFileExtensions: [
    "js",
    "json",
    "ts"
  ],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  collectCoverageFrom: [
    "src/**/*.(t|j)s",
    "!src/**/*.module.ts",
    '!**/*.controller.ts', // Controllers are tested via E2E tests
    '!**/*-handler.factory.ts', // Handler factories are thin wrappers tested via E2E
    '!**/*-operation-adapter.service.ts', // Operation adapters are thin delegation layers tested via E2E
    '!**/*.repository.ts', // Repositories are data access wrappers tested via E2E
    '!**/app.setup.ts', // Application bootstrap/config, tested via E2E
    '!**/app-bootstrap.ts', // Application bootstrap, tested via E2E
    "!src/**/*.spec.ts",
    "!src/**/*.test.ts"
  ],
  coverageDirectory: "./coverage",
  coverageReporters: [
    "text",
    "lcov",
    "html"
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  testEnvironment: "node",
  setupFilesAfterEnv: [
    "<rootDir>/test/jest.setup.ts"
  ]
};
