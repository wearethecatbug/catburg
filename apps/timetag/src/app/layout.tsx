import type { Metadata } from 'next';
import './globals.css';
import { SettingsProvider, TaskProvider } from '@/store';

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
        <SettingsProvider>
          <TaskProvider>{children}</TaskProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
