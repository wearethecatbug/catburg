import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('eslint').Linter.Config} */
const eslintConfig = {
  extends: ["next/core-web-vitals", "next/typescript"],
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
  },
};

export default eslintConfig;
