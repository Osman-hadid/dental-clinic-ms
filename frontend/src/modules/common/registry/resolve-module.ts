import { moduleRegistry, type ModuleRegistryEntry } from './module-registry';

export function resolveModule(relation: string): ModuleRegistryEntry | null {
  const entry = moduleRegistry[relation];

  if (!entry) {
    console.error(`[ModuleResolver] No module registered for relation: "${relation}"`);
    return null;
  }

  return entry;
}
