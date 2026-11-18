import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const simpleImportSort = require("eslint-plugin-simple-import-sort");
const sortKeysFix = require("eslint-plugin-sort-keys-fix");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Generated files (build output and Next's type stub), as in the standard
  // create-next-app config. Source code is still linted in full.
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "simple-import-sort": simpleImportSort,
      "sort-keys-fix": sortKeysFix,
    },
    rules: {
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            // React first, then other packages
            ["^react", "^@?\\w"],
            // Internal packages
            ["^(@|components)(/.*|$)"],

            // Side effect imports
            ["^\\u0000"],
            // Parent imports
            ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
            // Other relative imports
            ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
          ],
        },
      ],
      "simple-import-sort/exports": "error",
      "sort-keys-fix/sort-keys-fix": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
