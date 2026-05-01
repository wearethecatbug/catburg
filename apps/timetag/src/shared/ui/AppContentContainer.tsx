import React from 'react';

interface AppContentContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function AppContentContainer({ children, className = '' }: AppContentContainerProps) {
  return (
	<div
	  className={`mx-auto w-full px-3 sm:px-4 lg:px-6 xl:px-8 ${className}`.trim()}
	  style={{ maxWidth: 'var(--tt-content-max-width, 1160px)' }}
	>
	  {children}
	</div>
  );
}

