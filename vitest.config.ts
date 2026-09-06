import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Deliberately not vite.config.ts's `test` field: that config loads the
// TanStack Start SSR plugin and the Netlify adapter, neither of which a unit
// test needs, and both add real startup cost across hundreds of test files.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    // Two test files import the browser Supabase client at module load, and
    // createBrowserClient throws without a URL/key. CI has no .env, so hand
    // the tests obviously-fake values — no test may reach a real backend.
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
