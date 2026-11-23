import type { NextConfig } from "next";

/** The main dailymattr site. Nav and footer links to its pages go there. */
const mainSite = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.dailymattr.com").replace(/\/$/, "");

/** Pages that live on the main site, not in this quiz project. */
const mainSitePages = [
  "/about",
  "/advertise",
  "/benchmark",
  "/careers",
  "/download",
  "/formats/:path*",
  "/inside",
  "/login",
  "/news/:path*",
  "/news",
  "/newsletter",
  "/nia",
  "/privacy",
  "/privacypolicy",
  "/support",
  "/termsandconditions",
];

const nextConfig: NextConfig = {
  // Let other devices on the local network load dev assets.
  allowedDevOrigins: ["192.168.*.*"],
  images: {
    remotePatterns: [
      // Story photos in the dailymattr media bucket (components/quizz/content.ts).
      {
        protocol: "https",
        hostname: "coggfnbqqyiqfsxvtaym.supabase.co",
        pathname: "/storage/v1/object/public/pix-media/**",
        search: "",
      },
    ],
  },
  redirects() {
    return [
      // This project is the quiz: its home is the story picker.
      { source: "/", destination: "/quizz", permanent: false },
      ...mainSitePages.map((source) => ({
        source,
        destination: `${mainSite}${source}`,
        permanent: false,
      })),
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
