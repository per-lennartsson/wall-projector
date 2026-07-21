import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wall Projector',
  description: "Plan where images go on a wall before projecting them with a projector.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Mirrors the pre-rebuild Vite app's #root mount div — see the
            comment in globals.css for why this needs an explicit id. */}
        <div id="root">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
