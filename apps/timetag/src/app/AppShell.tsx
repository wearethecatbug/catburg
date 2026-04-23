'use client';

import React from 'react';
import { CONTENT_WIDTH_PRESETS } from '@/domain/settings.types';
import { useSettings } from '@/store';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const selectedWidth = CONTENT_WIDTH_PRESETS[settings.appearance.contentWidthMode].maxWidthPx;
  const shellStyle = {
    background: 'var(--tt-app-bg)',
    '--tt-content-max-width': `${selectedWidth}px`,
  } as React.CSSProperties & Record<'--tt-content-max-width', string>;

  return (
    <div className="min-h-screen w-full" style={shellStyle}>
      {children}
    </div>
  );
}


