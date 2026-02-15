import type { Metadata } from 'next';
import './globals.css';
import { TaskProvider } from '@/context';

export const metadata: Metadata = {
  title: 'TimeTag - Task Timer',
  description: 'A task list app with per-task timers and deadlines',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TaskProvider>{children}</TaskProvider>
      </body>
    </html>
  );
}

