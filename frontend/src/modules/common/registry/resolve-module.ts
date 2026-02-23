import { moduleRegistry, type ModuleRegistryEntry } from './module-registry';

export function resolveModule(relation: string): ModuleRegistryEntry | null {
  const aliases: Record<string, string> = {
    appointment: 'appointments',
    dentist: 'staff',
    invoice: 'invoices',
    module: 'modules',
    patient: 'patients',
    payment: 'payments',
    role: 'roles',
    staff: 'staff',
    tooth: 'teeth',
    treatment: 'treatments',
    visit: 'visits',
    visitTreatment: 'visitTreatments',
  };

  const normalizedRelation = relation.trim();
  const resolvedKey = aliases[normalizedRelation] ?? normalizedRelation;

  const entry = moduleRegistry[resolvedKey];

  if (!entry) {
    console.error(`[ModuleResolver] No module registered for relation: "${relation}"`);
    return null;
  }

  return entry;
}
