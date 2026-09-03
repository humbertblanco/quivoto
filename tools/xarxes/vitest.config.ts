// La config arrel només inclou `packages/*/src`; aquesta serveix per als tests
// del generador: `node_modules/.bin/vitest run --config tools/xarxes/vitest.config.ts`.
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tools/xarxes/**/*.test.ts"], environment: "node" } });
