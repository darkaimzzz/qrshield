import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100"

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  // Local runs build + serve with outbound network disabled so results are deterministic.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npx next start -p 3100",
        url: baseURL,
        timeout: 300_000,
        reuseExistingServer: true,
        env: { QRSHIELD_DISABLE_NETWORK: "1" },
      },
})
