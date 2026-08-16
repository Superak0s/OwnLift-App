module.exports = function (api) {
  api.cache(true);
  const isProduction = process.env.NODE_ENV === "production";
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./src"],
          alias: {
            "@features": "./src/features",
            "@shared": "./src/shared",
            "@utils": "./src/utils",
          },
        },
      ],
      // Backstop for stray console.log calls that slip past the shared
      // logger in release builds; error/warn stay so crash triage still works.
      isProduction && [
        "transform-remove-console",
        { exclude: ["error", "warn"] },
      ],
    ].filter(Boolean),
  };
};
