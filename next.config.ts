import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fonts read from disk by the PDF report route
  outputFileTracingIncludes: {
    "/api/reports/*": ["./src/lib/pdf/fonts/**/*"],
  },
};

export default nextConfig;
