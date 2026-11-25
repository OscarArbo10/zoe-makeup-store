import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZOÉ COSMETICS | Tienda de Maquillaje",
  description:
    "Maquillaje al detal y al por mayor. Elige tus tonos favoritos y realiza tu pedido fácil por WhatsApp.",
  icons: {
    icon: "/zoe-logo.jpg",
    apple: "/zoe-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-[#2D2226] selection:bg-[#FAD4E4] selection:text-[#2D2226]">
        {children}
      </body>
    </html>
  );
}
