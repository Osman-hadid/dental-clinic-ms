'use client';

import { type JSX, useEffect, useRef } from 'react';

const INTERACTIVE_SELECTOR =
  'a,button,[role="button"],[data-cursor="pointer"],.cursor-pointer,summary,label,[data-state="open"]';
const TEXT_SELECTOR =
  'input[type="text"],input[type="email"],input[type="password"],input[type="search"],input[type="url"],input[type="tel"],textarea,[contenteditable="true"]';

export const CustomCursor = (): JSX.Element => {
  const cursorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    if (!isFinePointer) return;

    const body = document.body;
    body.classList.add('custom-cursor-enabled');

    let lastTarget: Element | null = null;
    let latestTarget: Element | null = null;

    const updateCursor = (x: number, y: number) => {
      if (!cursorRef.current) return;
      cursorRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(var(--cursor-offset-x, -8px), var(--cursor-offset-y, -8px)) scale(var(--cursor-scale, 1))`;
    };

    const onMove = (event: PointerEvent) => {
      updateCursor(event.clientX, event.clientY);
      latestTarget = event.target instanceof Element ? event.target : null;

      if (latestTarget !== lastTarget) {
        lastTarget = latestTarget;
        const isOverText = lastTarget ? Boolean(lastTarget.closest(TEXT_SELECTOR)) : false;
        const isOverInteractive = lastTarget ? Boolean(lastTarget.closest(INTERACTIVE_SELECTOR)) : false;

        body.classList.toggle('custom-cursor--text', isOverText);
        body.classList.toggle('custom-cursor--interactive', isOverInteractive);
      }
    };

    const onDown = () => body.classList.add('custom-cursor--pressed');
    const onUp = () => body.classList.remove('custom-cursor--pressed');
    const onLeave = () => body.classList.add('custom-cursor--hidden');
    const onEnter = () => body.classList.remove('custom-cursor--hidden');

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('mouseenter', onEnter);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('mouseenter', onEnter);
      body.classList.remove(
        'custom-cursor-enabled',
        'custom-cursor--text',
        'custom-cursor--interactive',
        'custom-cursor--pressed',
        'custom-cursor--hidden'
      );
    };
  }, []);

  return (
    <div className="custom-cursor custom-cursor-icon" ref={cursorRef} />
  );
};
