import type { Metadata } from "next";
import Link from "next/link";
import SessionNav from "./session-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgendaFácil Pro",
  description: "Agendamentos online para profissionais autônomos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <nav>
          <Link className="brand" href="/">AgendaFácil Pro</Link>
          <SessionNav />
        </nav>
        {children}
      </body>
    </html>
  );
}
