import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fonts and the logo, read from disk by the PDF report route
  outputFileTracingIncludes: {
    "/api/reports/*": ["./src/lib/pdf/fonts/**/*", "./src/lib/pdf/logo.png"],
  },
  experimental: {
    // A page you've just looked at opens again from memory for half a minute,
    // with no trip to the server. Saving anything clears this at once (every
    // action calls revalidatePath), so what you changed is never shown stale.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
