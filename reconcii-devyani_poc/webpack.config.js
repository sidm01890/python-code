const WebpackObfuscator = require("webpack-obfuscator");

module.exports = {
  plugins: [
    new WebpackObfuscator({
      rotateStringArray: true,
      stringArray: true,
      stringArrayEncoding: ["base64"],
      compact: true,
    }),
  ],
};
