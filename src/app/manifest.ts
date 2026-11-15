import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return {
    name: "らくスコア",
    short_name: "らくスコア",
    description: "記号いらずの野球スコア記録",
    start_url: `${base}/`,
    scope: `${base}/`,
    id: `${base}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#070a08",
    theme_color: "#070a08",
    lang: "ja",
    categories: ["sports"],
    icons: [
      {
        src: `${base}/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/icon-512-maskable.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
