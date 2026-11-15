import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyLivePet",
    short_name: "MyLivePet",
    description: "Acompanhe o cuidado do seu pet com clareza, segurança e tranquilidade.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1F2A33",
    icons: [
      { src: "/brand/faviconpet.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
