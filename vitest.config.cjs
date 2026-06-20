const path = require("path");
module.exports = {
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.*"],
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
};
