
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import AppLayout from '@/components/layout/AppLayout';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter', 
});

export const metadata: Metadata = {
  title: 'konecte - Encuentra Tu Próxima Propiedad',
  description: 'Descubre, publica y comenta propiedades en arriendo o venta.',
  // Explicitly set icon types to empty arrays
  // to prevent Next.js from looking for default files in src/app/
  icons: {
    icon: [], // For favicon.ico, icon.svg, icon.png
    shortcut: [], // For shortcut icon
    apple: [], // For apple-touch-icon.png
    other: [], // For other custom icons
  },
  // Opcional: añadir Open Graph y Twitter card metadata para mejor sharing
  // openGraph: {
  //   title: 'konecte',
  //   description: 'Tu plataforma inmobiliaria moderna.',
  //   images: ['/og-image.png'], // Debes crear esta imagen
  // },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CL" className={`${inter.variable} antialiased`}>
      <body className="font-body"> {/* font-body se define en tailwind.config.ts */}
        <AppLayout>
          {children}
        </AppLayout>
        <Toaster />
      </body>
    </html>
  );
}
