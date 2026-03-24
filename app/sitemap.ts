import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://siroundchat.com",
      lastModified: new Date(),
    },
  ];
}
