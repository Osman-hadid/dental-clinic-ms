type RuntimeEnvironment = 'local' | 'test' | 'production';

const RUNTIME_ENVIRONMENT = (process.env.NEXT_PUBLIC_RUNTIME_ENVIRONMENT ||
  'local') as RuntimeEnvironment;

const IS_BROWSER = typeof window !== 'undefined';
const BROWSER_ORIGIN = IS_BROWSER ? window.location.origin : '';
const BROWSER_HOSTNAME = IS_BROWSER ? window.location.hostname : '';
const BROWSER_PORT = IS_BROWSER ? window.location.port : '';
const BROWSER_PROTOCOL = IS_BROWSER ? window.location.protocol : 'http:';

const IS_LOCAL_BROWSER = BROWSER_HOSTNAME === 'localhost' || BROWSER_HOSTNAME === '127.0.0.1';

const LOCAL_API_ORIGIN = IS_LOCAL_BROWSER
  ? (BROWSER_PORT === '3000'
      ? `${BROWSER_PROTOCOL}//${BROWSER_HOSTNAME}:8000`
      : (BROWSER_ORIGIN || 'http://localhost:8000'))
  : '';

export const APP_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ||
  BROWSER_ORIGIN ||
  'http://localhost:8000';

export const API_ORIGIN =
  LOCAL_API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  BROWSER_ORIGIN ||
  'http://localhost:8000';

export const ENV = RUNTIME_ENVIRONMENT;
