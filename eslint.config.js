import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["www/", "dist/", "android/", ".wrangler/", "node_modules/", "store-preview/"] },
  js.configs.recommended,
  { languageOptions: { globals: globals.node }, rules: { "no-unused-vars": ["error", { caughtErrors: "none" }] } },
  { files: ["public/**", "android-app/**"], languageOptions: { globals: globals.browser } },
  { files: ["worker/**"], languageOptions: { globals: globals.serviceworker } },
];
