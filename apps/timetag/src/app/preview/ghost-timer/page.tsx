import type { Metadata } from 'next';
import GhostTimerPreview from '@/app/preview/ghost-timer/GhostTimerPreview';

export const metadata: Metadata = {
  title: 'Ghost Timer Preview | TimeTag',
  description: 'Internal visual comparison for GhostTimer placeholder variants.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function GhostTimerPreviewPage() {
  return <GhostTimerPreview />;
}


