import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: "ControlNF's - Gestão de Obras, Medições e Pagamentos",
  description: "ControlNF's - Sistema para gestão administrativa de notas fiscais, ordens de compra, medições e pagamentos com suporte a múltiplas obras.",
  openGraph: {
    title: "ControlNF's - Gestão de Obras, Medições e Pagamentos",
    description: "ControlNF's - Sistema para gestão administrativa de notas fiscais, ordens de compra, medições e pagamentos com suporte a múltiplas obras.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "ControlNF's - Gestão de Obras, Medições e Pagamentos",
    description: "ControlNF's - Sistema para gestão administrativa de notas fiscais, ordens de compra, medições e pagamentos com suporte a múltiplas obras.",
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
