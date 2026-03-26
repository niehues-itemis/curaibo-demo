/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfjs-dist aus dem Turbopack-Bundling ausschließen —
  // Node.js lädt es direkt als natives ESM-Modul
  serverExternalPackages: ["pdfjs-dist", "imapflow", "mailparser", "pdfkit", "mammoth", "xlsx"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/9.x/**",
      },
    ],
  },
};

module.exports = nextConfig;
