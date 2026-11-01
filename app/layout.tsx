import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Controle de Notas Fiscais e Medições',
  description: 'Sistema full-stack para gestão administrativa de notas fiscais, ordens de compra, medições e pagamentos com suporte a múltiplas obras e controle de auditoria.',
  openGraph: {
    title: 'Controle de Notas Fiscais e Medições',
    description: 'Sistema full-stack para gestão administrativa de notas fiscais, ordens de compra, medições e pagamentos com suporte a múltiplas obras e controle de auditoria.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Controle de Notas Fiscais e Medições',
    description: 'Sistema full-stack para gestão administrativa de notas fiscais, ordens de compra, medições e pagamentos com suporte a múltiplas obras e controle de auditoria.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
