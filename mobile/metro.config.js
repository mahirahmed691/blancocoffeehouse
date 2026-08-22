const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const react = path.resolve(__dirname, "node_modules/react");
const reactDom = path.resolve(__dirname, "node_modules/react-dom");

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  react,
  "react-dom": reactDom
};

module.exports = config;
