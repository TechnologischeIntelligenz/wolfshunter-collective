import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const runtimeEnv: Record<string, string | undefined> = process.env;

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the Vite server.
// The CLI will eventually stop passing in HOST,
// so we can remove this workaround after the next major release.
if (
  runtimeEnv.HOST &&
  (!runtimeEnv.SHOPIFY_APP_URL ||
    runtimeEnv.SHOPIFY_APP_URL === runtimeEnv.HOST)
) {
  runtimeEnv.SHOPIFY_APP_URL = runtimeEnv.HOST;
  Reflect.deleteProperty(process.env, "HOST");
}

const host = new URL(runtimeEnv.SHOPIFY_APP_URL || "http://localhost")
  .hostname;
const isLocalHost = host === "localhost" || host === "127.0.0.1";

let hmrConfig;
if (isLocalHost) {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(runtimeEnv.FRONTEND_PORT!) || 8002,
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    allowedHosts: [
      "collective.wolfshunter.com",
      "app.wolfshunter.com",
      "rescue.wolfshunter.com",
      "localhost",
      "127.0.0.1",
    ],
    cors: {
      preflightContinue: true,
    },
    port: Number(runtimeEnv.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "node_modules"],
    },
  },
  preview: {
    allowedHosts: [
      "collective.wolfshunter.com",
      "app.wolfshunter.com",
      "rescue.wolfshunter.com",
      "localhost",
      "127.0.0.1",
    ],
  },
  plugins: [reactRouter(), tsconfigPaths()],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react"],
  },
}) satisfies UserConfig;
