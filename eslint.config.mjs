import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import next from "@next/eslint-plugin-next";
export default defineConfig([
  globalIgnores([".next/**", "src/generated/**", ".local/**", "next-env.d.ts"]),
  { files: ["**/*.ts", "**/*.tsx"], extends: [js.configs.recommended, ...ts.configs.recommended], rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] } },
  { files: ["src/**/*.tsx"], plugins: { "@next/next": next }, rules: { ...next.configs.recommended.rules } },
]);
