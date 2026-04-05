import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3099",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "cd services/api && npx tsx src/e2e-server.ts",
    cwd: "../..",
    port: 3099,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
