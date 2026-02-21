#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

// ANSI Colors
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';

console.log(`${CYAN}🔍 Checking filename conventions in src/...${RESET}\n`);

const walk = (dir: string, callback: (file: string) => void): void => {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, callback);
    } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
      callback(fullPath);
    }
  }
};

const checkFilename = (file: string): void => {
  const filename = file
    .split('/')
    .pop()!
    .replace(/\.(ts|tsx)$/, '');

  if (file.endsWith('/index.ts') || file.endsWith('/index.tsx')) {
    return;
  }

  const isHook = /src\/(modules\/[^/]+\/presentation\/hooks|hooks)\//.test(file);
  const isEntityOrInterface = /src\/(modules\/[^/]+\/domain\/(entities|interfaces)|types)\//.test(
    file
  );
  const isTest = /\.(test|spec)\.(ts|tsx)$/.test(file);
  const isConfig = /src\/modules\/[^/]+\/presentation\/config\//.test(file);

  let valid = true;
  let message = '';

  if (isHook) {
    if (!/^use[A-Z][a-zA-Z0-9]*$/.test(filename)) {
      valid = false;
      message = 'Must be: useSomething.ts (e.g., useAuth.ts, useUserList.ts)';
    }
  } else if (isEntityOrInterface) {
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(filename)) {
      valid = false;
      message = 'Must be PascalCase (e.g., User.ts, PermissionRepositoryInterface.ts)';
    }
  } else if (isConfig) {
    if (!/^[a-z0-9-]+$/.test(filename)) {
      valid = false;
      message = 'Must be kebab-case (e.g., role-config.ts)';
    }
  } else if (!isTest) {
    if (!/^[a-z0-9-]+$/.test(filename)) {
      valid = false;
      message = 'Must be kebab-case (e.g., create-user-form.tsx, list-users-use-case.ts)';
    }
  }

  if (!valid) {
    console.error(`${RED}❌ Bad filename: ${file}${RESET}`);
    console.error(`   ${RED}→${RESET} ${message}`);
    process.exit(1);
  }
};

walk('./src', checkFilename);

console.log(`${GREEN}✅ All filenames follow convention!${RESET}\n`);
