import { RefObject, useEffect, useRef } from 'react';

const focusable = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]';

// Shared by the existing dialog and member menu; opening/closing never changes routes.
export function useOverlayFocus(container: RefObject<HTMLElement>, openKey: boolean | number | null,
  close: () => void, trapFocus: boolean, busy = false, returnTarget?: RefObject<HTMLElement>) {
  const values = useRef({ close, busy });
  values.current = { close, busy };
  useEffect(() => {
    if (openKey === false || openKey === null) return;
    const element = container.current;
    if (!element) return;
    const previous = returnTarget?.current ?? document.activeElement as HTMLElement | null;
    const items = () => [...element.querySelectorAll<HTMLElement>(focusable)];
    (items()[0] ?? element).focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (!values.current.busy) values.current.close();
      } else if (event.key === 'Tab' && trapFocus) {
        const options = items();
        const index = options.indexOf(document.activeElement as HTMLElement);
        if (!options.length) { event.preventDefault(); element.focus(); }
        else if (event.shiftKey && index <= 0) { event.preventDefault(); options[options.length - 1].focus(); }
        else if (!event.shiftKey && (index === options.length - 1 || index === -1)) { event.preventDefault(); options[0].focus(); }
      } else if (!trapFocus && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        const options = items();
        if (!options.length) return;
        event.preventDefault();
        const index = options.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next].focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!trapFocus && !element.contains(event.target as Node) && event.target !== previous) values.current.close();
    };
    element.addEventListener('keydown', handleKey);
    document.addEventListener('pointerdown', outside);
    return () => {
      element.removeEventListener('keydown', handleKey);
      document.removeEventListener('pointerdown', outside);
      if (previous?.isConnected) previous.focus();
      else if (trapFocus) document.querySelector<HTMLElement>('.group-info-heading button')?.focus();
    };
  }, [container, openKey, trapFocus, returnTarget]);
}
