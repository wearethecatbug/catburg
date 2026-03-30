import type { Metadata } from 'next';
import './globals.css';
import { ThemeController } from './ThemeController';
import { getThemeInitScript } from '@/domain/theme';
import { SETTINGS_STORAGE_KEY } from '@/domain/settings.types';
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>TimeTag - Task Timer</title>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript(SETTINGS_STORAGE_KEY) }} />
      </head>
      <body suppressHydrationWarning>
        <SettingsProvider>
          <ThemeController />
          <TaskProvider>{children}</TaskProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
