import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '../lib/gsap';
import { fadeUp } from '../lib/animations';

interface ScrollRevealOptions {
  start?: string;
  once?: boolean;
  delay?: number;
}

export function useScrollReveal<T extends HTMLElement>(
  options: ScrollRevealOptions = {}
) {
  const ref = useRef<T>(null);
  const { start = 'top 85%', once = true, delay = 0 } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const from = fadeUp();

    if (from.duration === 0) {
      // Reduced motion — just ensure visible
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }

    gsap.set(el, { opacity: 0, y: from.y });

    const trigger = ScrollTrigger.create({
      trigger: el,
      start,
      once,
      onEnter: () => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: from.duration,
          ease: from.ease,
          delay,
        });
      },
    });

    return () => {
      trigger.kill();
    };
  }, [start, once, delay]);

  return ref;
}
