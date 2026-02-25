import { type ReactNode } from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export default function ScrollReveal({ children, className = '', delay = 0 }: ScrollRevealProps) {
  const ref = useScrollReveal<HTMLDivElement>({ delay });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
