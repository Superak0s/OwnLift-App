const tseslint = require("typescript-eslint");
const reactNative = require("eslint-plugin-react-native");

module.exports = [
  {
    files: ["**/*.{ts,tsx}"],

    ignores: [
      "node_modules/**",
      ".expo/**",
      "dist/**",
      "build/**",
      "android/**",
      "ios/**",
    ],

    plugins: {
      "react-native": reactNative,
    },

    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    rules: {
      "react-native/no-unused-styles": "error",
    },
  },
];
