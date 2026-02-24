import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./main.css";
import { Providers } from "@/components/providers/Providers";
import DevBadge from "@/components/ui/DevBadge";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MegaMais",
  description: "Sistema Avançado de Gestão para Lotéricas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {/* Script para matar Service Workers zumbis que causam cache agressivo */}
        <script dangerouslySetInnerHTML={{
          __html: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
              for (let registration of registrations) { registration.unregister(); }
            });
          }
          if ('caches' in window) {
            caches.keys().then(names => { names.forEach(name => caches.delete(name)); });
          }
        `}} />
        <Providers>
          {children}
        </Providers>
        <DevBadge />
      </body>
    </html>
  );
}
