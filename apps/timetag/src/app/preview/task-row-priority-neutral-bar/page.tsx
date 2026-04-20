import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Task Row Priority Preview | TimeTag',
  description: 'Redirects to the consolidated TaskRow priority preview host.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function TaskRowPriorityNeutralBarPreviewPage() {
  redirect('/preview/task-row-priority');
}


