import { useEffect, useRef } from 'react';
import { gsap } from '../lib/gsap';
import { staggerConfig } from '../lib/animations';

export function useStagger<T extends HTMLElement>(
  childSelector = ':scope > *',
  deps: React.DependencyList = []
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const children = el.querySelectorAll(childSelector);
    if (children.length === 0) return;

    const stagger = staggerConfig();
    if (stagger === 0) {
      // Reduced motion
      gsap.set(children, { opacity: 1, y: 0 });
      return;
    }

    gsap.set(children, { opacity: 0, y: 30 });

    const ctx = gsap.context(() => {
      gsap.to(children, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger,
        ease: 'power3.out',
        delay: 0.1,
      });
    });

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
