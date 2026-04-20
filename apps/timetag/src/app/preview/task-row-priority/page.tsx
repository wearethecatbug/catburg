import type { Metadata } from 'next';
import TaskRowPriorityPreview from './TaskRowPriorityPreview';

export const metadata: Metadata = {
  title: 'Task Row Priority Preview | TimeTag',
  description: 'Internal visual comparison for TaskRow urgent-priority presentation variants.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function TaskRowPriorityPreviewPage() {
  return <TaskRowPriorityPreview />;
}

