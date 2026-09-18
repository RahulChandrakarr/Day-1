import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fonts and the logo, read from disk by the PDF report route
  outputFileTracingIncludes: {
    "/api/reports/*": ["./src/lib/pdf/fonts/**/*", "./src/lib/pdf/logo.png"],
  },
};

export default nextConfig;
