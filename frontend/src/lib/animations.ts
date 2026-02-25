const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const fadeUp = () =>
  prefersReducedMotion()
    ? { opacity: 1, y: 0, duration: 0 }
    : { opacity: 0, y: 40, duration: 0.8, ease: 'power3.out' };

export const fadeIn = () =>
  prefersReducedMotion()
    ? { opacity: 1, duration: 0 }
    : { opacity: 0, duration: 0.6, ease: 'power2.out' };

export const slideInRight = () =>
  prefersReducedMotion()
    ? { opacity: 1, x: 0, duration: 0 }
    : { opacity: 0, x: 60, duration: 0.7, ease: 'power3.out' };

export const scaleIn = () =>
  prefersReducedMotion()
    ? { opacity: 1, scale: 1, duration: 0 }
    : { opacity: 0, scale: 0.95, duration: 0.5, ease: 'power2.out' };

export const staggerConfig = () =>
  prefersReducedMotion() ? 0 : 0.08;
