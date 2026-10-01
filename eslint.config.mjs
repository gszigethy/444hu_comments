export default [
  {
    files: ["*.js"],
    ignores: ["backburner.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "script" },
    rules: {
      "constructor-super": "error",
      "no-unreachable": "error",
      "no-constant-condition": "error",
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-func-assign": "error",
      "valid-typeof": "error",
      "use-isnan": "error",
    },
  },
  {
    // The injected modern implementation imports the shared Backburner module.
    files: ["444hu_comments_inject.js"],
    languageOptions: { sourceType: "module" },
  },
];
