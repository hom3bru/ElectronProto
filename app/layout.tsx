import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

export const metadata: Metadata = {
  title: 'Internal Agent Workspace',
  description: 'Internal Agent Workspace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-50 flex h-screen overflow-hidden font-sans antialiased">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-auto relative">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
