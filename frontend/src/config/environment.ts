type RuntimeEnvironment = 'local' | 'test' | 'production';

const RUNTIME_ENVIRONMENT = (process.env.NEXT_PUBLIC_RUNTIME_ENVIRONMENT ||
  'local') as RuntimeEnvironment;

const resolveBrowserOrigin = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  return window.location.origin;
};

const isLocalBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

const resolveLocalApiOrigin = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  if (window.location.port === '3000') return `${window.location.protocol}//${window.location.hostname}:8000`;
  return window.location.origin;
};

export const APP_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ||
  resolveBrowserOrigin() ||
  'http://localhost:8000';

export const API_ORIGIN =
  (isLocalBrowser() ? resolveLocalApiOrigin() : undefined) ||
  process.env.NEXT_PUBLIC_API_URL ||
  resolveBrowserOrigin() ||
  'http://localhost:8000';

export const ENV = RUNTIME_ENVIRONMENT;
