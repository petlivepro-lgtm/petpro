import type { MetadataRoute } from "next";

/**
 * O painel vira instalável para poder receber push no celular: no iPhone o
 * Web Push só funciona depois de "Adicionar à Tela de Início", e no Android
 * o app instalado recebe aviso mesmo com o navegador fechado.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pet Live Pro",
    short_name: "Pet Live Pro",
    description: "Gestão do petshop: solicitações, atendimentos, estoque e caixa.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1F2A33",
    icons: [{ src: "/brand/faviconpet.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
