import type { ReactNode } from 'react';

type BootstrapContainerProps = {
  children: ReactNode;
  className?: string;
};

export default function BootstrapContainer({ children, className = '' }: BootstrapContainerProps) {
  return (
    <div
      className={[
        'mx-auto w-full px-3 sm:px-4 lg:px-6',
        'max-w-[540px] sm:max-w-[720px] md:max-w-[960px] lg:max-w-[1140px] xl:max-w-[1320px]',
        className
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
