import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["app/**/*.test.{ts,tsx}"],
    clearMocks: true,
    // Fixtures independentes da configuração real do Auth0.
    env: {
      VITE_AUTH0_DOMAIN: "test.auth0.com",
      VITE_AUTH0_CLIENT_ID: "test-client",
      VITE_AUTH0_AUDIENCE: "https://api.example.test",
      VITE_PROFILE_API_URL: "http://localhost:8081",
      VITE_RECOMMENDATIONS_API_URL: "http://localhost:8082",
      VITE_PORTFOLIO_API_URL: "http://localhost:8083",
    },
  },
});
