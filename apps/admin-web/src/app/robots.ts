import type { MetadataRoute } from "next";

// O admin não existe para buscador nenhum.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
