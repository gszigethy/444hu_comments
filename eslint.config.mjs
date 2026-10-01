export default [{
  files: ["*.js"],
  ignores: ["backburner.js"],
  languageOptions: { ecmaVersion: "latest", sourceType: "script" },
  rules: {
    "constructor-super": "error", "no-unreachable": "error",
    "no-constant-condition": "error", "no-dupe-args": "error",
    "no-dupe-keys": "error", "no-func-assign": "error",
    "valid-typeof": "error", "use-isnan": "error"
  }
}];
