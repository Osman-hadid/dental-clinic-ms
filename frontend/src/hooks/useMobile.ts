import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = globalThis.matchMedia?.(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    if (mql) {
      const onChange = (): void => setIsMobile(mql.matches);

      onChange();
      mql.addEventListener('change', onChange);

      return () => {
        mql.removeEventListener('change', onChange);
      };
    } else {
      setIsMobile(globalThis.innerWidth < MOBILE_BREAKPOINT);
    }

    return undefined;
  }, []);

  return !!isMobile;
};
