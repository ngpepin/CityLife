const { withGTConfig } = require("gt-next/config");
const path = require("path");

const appRoot = path.resolve(__dirname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  outputFileTracingRoot: appRoot,
  turbopack: {
    root: appRoot,
  },
};

module.exports = withGTConfig(nextConfig);
