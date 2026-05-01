import type { Metadata } from 'next';
import WorkspaceCarouselPreview from './WorkspaceCarouselPreview';

export const metadata: Metadata = {
  title: 'Workspace Carousel Preview | TimeTag',
  description: 'Internal visual comparison for workspace navigation patterns including carousel arrows, wrapped rails, overflow models, and dropdown switchers.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function WorkspaceCarouselPreviewPage() {
  return <WorkspaceCarouselPreview />;
}


