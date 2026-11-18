'use client';

import { JSX, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { useAuthStore } from '@/modules/auth/application/stores/auth-store';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import Cookies from 'js-cookie';
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  KeyRound,
  Languages,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

const apiClient = new AxiosClient();

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? '')
    .join('');

const formatPermission = (permission: string): string =>
  permission
    .replace(/^page\./, '')
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toLocaleUpperCase() ?? ''}${part.slice(1)}`)
    .join(' · ');

// eslint-disable-next-line react/function-component-definition
export default function AccountPage(): JSX.Element {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const t = useTranslations('account');
  const tGlobal = useTranslations('global');
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);

  const handleLanguageChange = async (newLocale: string): Promise<void> => {
    if (!routing.locales.includes(newLocale as Locale) || newLocale === locale || !user) return;

    setIsSavingLanguage(true);
    try {
      await apiClient.get('/sanctum/csrf-cookie', {
        headers: { Accept: 'application/json' },
      });
      if (!Cookies.get('XSRF-TOKEN')) {
        throw new Error('CSRF token was not set');
      }

      await apiClient.post(
        '/api/me/locale',
        { locale: newLocale },
        { headers: { Accept: 'application/json' } }
      );
      setUser({ ...user, locale: newLocale });
      toast.success(t('languageUpdated'));
      router.push(pathname, { locale: newLocale as Locale });
    } catch {
      toast.error(t('languageFailed'));
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  const permissionNames = (user?.permissions ?? [])
    .map((permission) => (typeof permission === 'string' ? permission : permission.name))
    .filter(Boolean);
  const visiblePermissions = permissionNames.slice(0, 10);
  const accountRightLevel = user?.rights?.toLowerCase();
  const rightLevel = accountRightLevel === 'creates' ? 'create' : accountRightLevel;
  const roles = user?.roles ?? [];
  const rightLevelLabel =
    rightLevel === 'create' || rightLevel === 'review' || rightLevel === 'approval'
      ? t(`levels.${rightLevel}`)
      : user?.rights || '—';

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dashboard', href: '/dashboard', label: tGlobal('dashboard') },
          { id: 'account', isCurrent: true, label: t('title') },
        ]}
      />
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-5 md:gap-7 md:px-6 md:py-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t('profileOverview')}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {t('title')}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground md:text-base">
              {t('description')}
            </p>
          </div>
          <Button asChild variant="outline" className="self-start rounded-xl sm:self-auto">
            <Link href="/dashboard">
              <ArrowLeft className="size-4 rtl:rotate-180" />
              {t('backToDashboard')}
            </Link>
          </Button>
        </div>

        {!user ? (
          <div className="rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground shadow-sm">
            {t('accountUnavailable')}
          </div>
        ) : (
          <>
            <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-teal-950 via-teal-800 to-emerald-700 px-6 py-7 text-white shadow-[0_24px_70px_-34px_rgba(13,90,79,0.8)] md:px-9 md:py-9">
              <div className="pointer-events-none absolute -end-12 -top-28 size-80 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -end-2 -top-20 size-60 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -bottom-28 start-1/3 size-64 rounded-full bg-emerald-300/10 blur-3xl" />
              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
                <Avatar className="size-20 shrink-0 border-2 border-white/30 shadow-lg md:size-24">
                  <AvatarImage src={user.profilePhotoPath || undefined} alt={fullName} />
                  <AvatarFallback className="bg-white/15 text-xl font-semibold text-white">
                    {getInitials(fullName) || <UserRound className="size-8" />}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Badge className="mb-3 gap-1.5 border border-emerald-200/25 bg-white/10 text-white hover:bg-white/10">
                    <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,0.15)]" />
                    {t('signedIn')}
                  </Badge>
                  <h2 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
                    {fullName || t('roleFallback')}
                  </h2>
                  <p className="mt-1 truncate text-sm text-teal-50/80 md:text-base">{user.email}</p>
                </div>
                <div className="flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-teal-50/90 backdrop-blur-sm">
                  <ShieldCheck className="size-4 text-emerald-200" />
                  <span>
                    <span className="me-1.5 text-xs text-teal-100/65">{t('permissionLevel')}</span>
                    <span className="font-semibold text-white">{rightLevelLabel}</span>
                  </span>
                </div>
              </div>
            </section>

            <div className="grid min-w-0 gap-5 xl:grid-cols-[1.12fr_0.88fr] xl:gap-6">
              <div className="flex min-w-0 flex-col gap-5 xl:gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <UserRound className="size-5" />
                    </span>
                    <div className="space-y-1">
                      <CardTitle>{t('personalDetails')}</CardTitle>
                      <CardDescription>{t('personalDetailsDescription')}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('fullName')}
                      </p>
                      <p className="truncate text-sm font-semibold text-foreground">
                        {fullName || '—'}
                      </p>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('emailAddress')}
                      </p>
                      <p className="truncate text-sm font-semibold text-foreground">{user.email}</p>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('accountId')}
                      </p>
                      <p className="truncate font-mono text-sm font-medium text-foreground">
                        #{user.id}
                      </p>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('accountStatus')}
                      </p>
                      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <BadgeCheck className="size-4 text-emerald-600" />
                        {t('active')}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
                      <BriefcaseBusiness className="size-5" />
                    </span>
                    <div className="space-y-1">
                      <CardTitle>{t('workspaceAccess')}</CardTitle>
                      <CardDescription>{t('workspaceAccessDescription')}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('roles')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {roles.length > 0 ? (
                          roles.map((role) => (
                            <Badge
                              key={role}
                              variant="secondary"
                              className="rounded-full px-3 py-1"
                            >
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('noRoles')}</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/35 p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
                        <KeyRound className="size-4 text-primary" />
                        {t('permissions')}
                        <span className="ms-auto max-w-full text-end text-xs font-medium text-muted-foreground">
                          {permissionNames.length > 0
                            ? t('permissionCount', { count: permissionNames.length })
                            : t('noPermissions')}
                        </span>
                      </div>
                      {visiblePermissions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {visiblePermissions.map((permission) => (
                            <span
                              key={permission}
                              className="max-w-full truncate rounded-lg border border-border/70 bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground"
                              title={formatPermission(permission)}
                            >
                              {formatPermission(permission)}
                            </span>
                          ))}
                          {permissionNames.length > visiblePermissions.length ? (
                            <span className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary">
                              +{permissionNames.length - visiblePermissions.length}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="h-fit">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
                    <Languages className="size-5" />
                  </span>
                  <div className="space-y-1">
                    <CardTitle>{t('preferences')}</CardTitle>
                    <CardDescription>{t('preferencesDescription')}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label htmlFor="account-language" className="text-sm font-semibold">
                    {t('language')}
                  </label>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t('languageDescription')}
                  </p>
                  <Select
                    value={locale}
                    onValueChange={handleLanguageChange}
                    disabled={isSavingLanguage}
                  >
                    <SelectTrigger
                      id="account-language"
                      className="w-full rounded-xl bg-background"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {routing.locales.map((availableLocale) => (
                        <SelectItem key={availableLocale} value={availableLocale}>
                          {t(`languageOptions.${availableLocale}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isSavingLanguage ? (
                    <p className="text-xs text-muted-foreground" role="status">
                      {t('languageSaving')}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </>
  );
}
