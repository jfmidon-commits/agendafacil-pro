import type { Metadata } from "next";
import Link from "next/link";
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
          <Link href="/dashboard">Painel</Link>
          <Link href="/dashboard/services">Serviços</Link>
          <Link href="/dashboard/availability">Horários</Link>
          <Link href="/login">Entrar</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
