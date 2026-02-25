import { useEffect, useRef } from 'react';
import { gsap } from '../lib/gsap';

export function useGSAP(
  callback: (ctx: gsap.Context) => void,
  deps: React.DependencyList = [],
  scope?: React.RefObject<HTMLElement | null>
) {
  const ctxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    let ctx: gsap.Context;
    ctx = gsap.context((context) => {
      ctx = context as gsap.Context;
      callback(context as gsap.Context);
    }, scope?.current || undefined);
    ctxRef.current = ctx;

    return () => {
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ctxRef;
}
