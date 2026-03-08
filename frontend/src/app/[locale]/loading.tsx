import { JSX } from 'react';
import { LoadingState } from '@/components/shared/loading-state';

export default function LocaleLoading(): JSX.Element {
  return (
    <LoadingState
      fullPage
      title="Opening page"
      description="Loading layout, permissions, and the first data blocks."
    />
  );
}
