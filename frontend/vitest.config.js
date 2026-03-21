import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const resolvedEnvironment = process.env.VITEST_ENV || "jsdom";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: resolvedEnvironment,
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**", "src/_inspiration_reset_20260312/**"],
    watch: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    teardownTimeout: 5000,
    reporters: process.env.VITEST_REPORTER ? [process.env.VITEST_REPORTER] : ["default"],
  },
});
