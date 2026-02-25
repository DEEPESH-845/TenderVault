import { useRef, type ReactNode } from 'react';
import { useGSAP } from '../hooks/useGSAP';
import { gsap } from '../lib/gsap';
import { fadeUp } from '../lib/animations';

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

export default function AnimatedPage({ children, className = '' }: AnimatedPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = containerRef.current;
    if (!el) return;

    const from = fadeUp();
    if (from.duration === 0) return;

    gsap.fromTo(
      el,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }
    );
  }, []);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
