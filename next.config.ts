// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/models/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600" }, // or longer if stable
        ],
      },
    ];
  },
};
