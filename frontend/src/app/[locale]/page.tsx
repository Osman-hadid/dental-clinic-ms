import { redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';

// Static export needs each locale route materialized at build time.
export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootPage({ params }: PageProps<'/[locale]'>): Promise<never> {
  const { locale } = await params;

  redirect(`/${locale}/dashboard`);
}
