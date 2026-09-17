import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Architecture rule: @supabase/supabase-js may only be imported inside
  // lib/backend/supabase/** — see architecture-scaffold.md §1 and §8.
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ignores: ["lib/backend/supabase/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@supabase/supabase-js",
              message:
                "Do not import @supabase/supabase-js outside lib/backend/supabase/**. Go through the Backend interface in lib/backend/contracts.ts instead.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
