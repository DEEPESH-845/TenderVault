import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

gsap.defaults({
  duration: 0.8,
  ease: 'power3.out',
});

export { gsap, ScrollTrigger };
