import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Day One",
    short_name: "Day One",
    description: "My personal life tracker",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f8fd",
    theme_color: "#f3f8fd",
    shortcuts: [
      {
        name: "Add entry",
        short_name: "Add",
        description: "Log money you spent or earned",
        url: "/financial/daily?add=entry",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Quick journal note",
        short_name: "Journal",
        url: "/daily?add=journal",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Workout",
        short_name: "Gym",
        url: "/health/gym?add=workout",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Habits",
        short_name: "Habits",
        url: "/health/habits?add=habit",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
