import type { Metadata, Viewport } from "next";
import { Manrope, Inter, Sora } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-heading" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const sora = Sora({ subsets: ["latin"], variable: "--font-accent" });

export const metadata: Metadata = {
  metadataBase: new URL("https://petlivepro.com.br"),
  title: "Pet Live Pro: o quadro do dia do petshop, com o tutor acompanhando ao vivo",
  description:
    "Agenda, atendimentos, leva-e-traz, Clubinho, estoque e caixa num quadro só. Quando o pet entra na sala, a câmera abre no celular do tutor.",
  icons: { icon: "/brand/faviconpet.svg" },
  openGraph: {
    title: "Pet Live Pro: todo pet do dia num quadro só",
    description: "E o tutor acompanhando junto, pela câmera ao vivo do banho e da tosa.",
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${inter.variable} ${sora.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
