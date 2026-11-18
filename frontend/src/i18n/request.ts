import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

type Messages = {
  account: Record<string, unknown>;
  app: Record<string, unknown>;
  auth: Record<string, unknown>;
  component: Record<string, unknown>;
  dashboard: Record<string, unknown>;
  global: Record<string, unknown>;
  sidebar: Record<string, unknown>;
  user: Record<string, unknown>;
  role: Record<string, unknown>;
  permission: Record<string, unknown>;
  module: Record<string, unknown>;
  patient: Record<string, unknown>;
  patientQuestion: Record<string, unknown>;
  staff: Record<string, unknown>;
  appointment: Record<string, unknown>;
  visit: Record<string, unknown>;
  tooth: Record<string, unknown>;
  treatment: Record<string, unknown>;
  visitTreatment: Record<string, unknown>;
  invoice: Record<string, unknown>;
  payment: Record<string, unknown>;
  clinicProfile: Record<string, unknown>;
};

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) || routing.defaultLocale;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const messages: Messages = {
    account: (await import(`@/messages/${locale}/account.json`)).default,
    app: (await import(`@/messages/${locale}/app.json`)).default,
    auth: (await import(`@/messages/${locale}/auth.json`)).default,
    component: (await import(`@/messages/${locale}/component.json`)).default,
    dashboard: (await import(`@/messages/${locale}/dashboard.json`)).default,
    global: (await import(`@/messages/${locale}/global.json`)).default,
    module: (await import(`@/messages/${locale}/settings/module.json`)).default,
    permission: (await import(`@/messages/${locale}/user-management/permission.json`)).default,
    role: (await import(`@/messages/${locale}/user-management/role.json`)).default,
    sidebar: (await import(`@/messages/${locale}/sidebar.json`)).default,
    user: (await import(`@/messages/${locale}/user-management/user.json`)).default,
    patient: (await import(`@/messages/${locale}/dental-management/patient.json`)).default,
    patientQuestion: (await import(`@/messages/${locale}/dental-management/patient-question.json`))
      .default,
    staff: (await import(`@/messages/${locale}/dental-management/staff.json`)).default,
    appointment: (await import(`@/messages/${locale}/dental-management/appointment.json`)).default,
    visit: (await import(`@/messages/${locale}/dental-management/visit.json`)).default,
    tooth: (await import(`@/messages/${locale}/dental-management/tooth.json`)).default,
    treatment: (await import(`@/messages/${locale}/dental-management/treatment.json`)).default,
    visitTreatment: (await import(`@/messages/${locale}/dental-management/visit-treatment.json`))
      .default,
    invoice: (await import(`@/messages/${locale}/dental-management/invoice.json`)).default,
    payment: (await import(`@/messages/${locale}/dental-management/payment.json`)).default,
    clinicProfile: (await import(`@/messages/${locale}/dental-management/clinic-profile.json`))
      .default,
  };

  return { locale, messages };
});
