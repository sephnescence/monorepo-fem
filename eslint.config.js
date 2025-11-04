// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import vitestPlugin from "eslint-plugin-vitest";

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.nx/**",
      "**/node_modules/**",
      "**/.aws-sam/**",
    ],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // JavaScript/Node.js configuration
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Node.js globals
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        exports: "writable",
        module: "readonly",
        require: "readonly",
      },
    },
  },

  // TypeScript configuration - minimal rules focusing on type imports
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [tseslint.configs.base],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Node.js globals
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      import: importPlugin,
    },
    rules: {
      // Enforce consistent type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      // Import plugin rules for organisation
      "import/no-duplicates": "error",
      "import/first": "error",
      "import/newline-after-import": "warn",
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "never",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
    },
  },

  // Vitest rules for test files only
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    plugins: {
      vitest: vitestPlugin,
    },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
    },
  }
);
