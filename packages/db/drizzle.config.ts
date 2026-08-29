import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;

export default defineConfig(
  url
    ? { schema: "./src/schema/index.ts", out: "./drizzle", dialect: "postgresql", dbCredentials: { url } }
    : {
        schema: "./src/schema/index.ts",
        out: "./drizzle",
        dialect: "postgresql",
        driver: "pglite",
        dbCredentials: { url: "./.data/quivoto" },
      },
);
