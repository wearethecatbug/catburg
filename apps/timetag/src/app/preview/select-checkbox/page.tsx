import type { Metadata } from 'next';
import SelectCheckboxPreview from './SelectCheckboxPreview';

export const metadata: Metadata = {
  title: 'Variant B Task Row Controls Preview | TimeTag',
  description: 'Internal visual preview for the approved Variant B select checkbox and done-button hover states in task rows.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SelectCheckboxPreviewPage() {
  return <SelectCheckboxPreview />;
}


