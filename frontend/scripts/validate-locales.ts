#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

// ANSI Colors
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

const BASE_LOCALE = 'en';
const LOCALES = ['ps', 'dr'];
const MESSAGES_DIR = resolve('src/messages');
const BASE_DIR = join(MESSAGES_DIR, BASE_LOCALE);

console.log(`${CYAN}🔍 Validating translation files against English...${RESET}\n`);

if (!existsSync(BASE_DIR)) {
  console.error(`${RED}❌ Base locale directory not found: ${BASE_DIR}${RESET}`);
  process.exit(1);
}

const getAllKeys = (obj: any, prefix = ''): string[] => {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj ?? {})) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
};

const walk = (dir: string, callback: (filePath: string, relativePath: string) => void): void => {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, callback);
    } else if (entry.isFile() && extname(entry.name) === '.json') {
      const relativePath = relative(BASE_DIR, fullPath);
      callback(fullPath, relativePath);
    }
  }
};

walk(BASE_DIR, (baseFilePath, relativePath) => {
  let baseJson: any;
  try {
    baseJson = JSON.parse(readFileSync(baseFilePath, 'utf-8'));
  } catch {
    console.error(`${RED}❌ Invalid JSON in English file: ${relativePath}${RESET}`);
    process.exit(1);
  }

  const baseKeys = new Set(getAllKeys(baseJson));

  if (baseKeys.size === 0) {
    console.warn(`${YELLOW}⚠️  Empty or no translatable keys in: ${relativePath}${RESET}`);
  }

  for (const locale of LOCALES) {
    const localeFilePath = join(MESSAGES_DIR, locale, relativePath);

    if (!existsSync(localeFilePath)) {
      console.error(`${RED}\n❌ Missing translation file: ${localeFilePath}${RESET}`);
      process.exit(1);
    }

    let localeJson: any;
    try {
      localeJson = JSON.parse(readFileSync(localeFilePath, 'utf-8'));
    } catch {
      console.error(`${RED}❌ Invalid JSON in [${locale}]: ${relativePath}${RESET}`);
      process.exit(1);
    }

    const localeKeys = new Set(getAllKeys(localeJson));

    const missing = [...baseKeys].filter((k) => !localeKeys.has(k));
    if (missing.length > 0) {
      console.error(
        `${RED}\n❌ Missing ${missing.length} key(s) in [${locale}] → ${relativePath}${RESET}`
      );
      missing.forEach((key) => console.error(`   ${RED}-${RESET} ${key}`));
      process.exit(1);
    }

    const extra = [...localeKeys].filter((k) => !baseKeys.has(k));
    if (extra.length > 0) {
      console.warn(
        `${YELLOW}\n⚠️  Extra ${extra.length} key(s) in [${locale}] → ${relativePath}${RESET}`
      );
      extra.slice(0, 10).forEach((key) => console.warn(`   ${YELLOW}+${RESET} ${key}`));
      if (extra.length > 10) console.warn(`   ${YELLOW}... and ${extra.length - 10} more${RESET}`);
    }
  }
});

console.log(`${GREEN}\n✅ All locale files are complete and valid!${RESET}`);
