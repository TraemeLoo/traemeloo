import { Unbounded, DM_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";

const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-unbounded",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
});

export const metadata = {
  title: "TraemeLoo — Compra Todo, Entregado Rápido",
  description: "Tus tiendas favoritas, entregadas directo a tu puerta.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${unbounded.variable} ${dmSans.variable}`}>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
