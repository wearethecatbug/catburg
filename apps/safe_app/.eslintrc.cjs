module.exports = {
  extends: ["eslint:recommended", "next/core-web-vitals", "next/typescript"],
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: "detect" },
  },
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
  },
};
