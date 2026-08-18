import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  test: {
    // Node by default. Files needing a DOM opt in with a
    // `// @vitest-environment jsdom` docblock at the top.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Sequential: the two performance guards measure wall-clock time, and
    // parallel workers competing for the machine makes them lie.
    fileParallelism: false,
  },
});
