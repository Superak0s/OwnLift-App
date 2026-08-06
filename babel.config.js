module.exports = function (api) {
  api.cache(true);
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
            "@models": "./src/types",
            "@utils": "./src/utils",
          },
        },
      ],
    ],
  };
};
