'use client';

import { JSX, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { EntityForm } from '@/components/shared/entity/entity-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clinicProfileConfig } from '@/modules/dental-management/presentation/config/clinic-profile-config';
import { useClinicProfile, useUpdateClinicProfile } from '@/modules/dental-management/presentation/hooks';
import { toast } from 'sonner';

// eslint-disable-next-line react/function-component-definition
export default function ClinicProfilePage(): JSX.Element {
  const t = useTranslations('clinicProfile');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const { data: clinicProfileResponse } = useClinicProfile();
  const updateMutation = useUpdateClinicProfile();
  const profile = clinicProfileResponse?.data ?? null;

  const defaultValues = useMemo(() => profile ?? {}, [profile]);

  const handleSubmit = async (payload: Record<string, any>): Promise<{ success: boolean }> => {
    const response = await updateMutation.mutateAsync(payload);

    if (response.success) {
      toast.success(t('messages.updateSuccess'));
    } else {
      toast.error(response.error?.message ?? t('messages.updateFailed'));
    }

    return { success: response.success };
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'clinicProfile', isCurrent: true, label: t('page.title') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-6 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle>{t('page.title')}</CardTitle>
                <CardDescription>{t('page.description')}</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <EntityForm
                  config={clinicProfileConfig}
                  defaultValues={defaultValues}
                  formConfig={clinicProfileConfig.formFields}
                  onSubmit={handleSubmit}
                  onSuccess={() => undefined}
                  keepValuesOnSuccess
                  submitText={t('config.table.update')}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
