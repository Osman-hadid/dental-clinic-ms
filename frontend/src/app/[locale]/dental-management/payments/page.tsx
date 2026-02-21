'use client';

import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { paymentConfig } from '@/modules/dental-management/presentation/config/payment-config';
import {
  useCreatePayment,
  useDeletePayment,
  usePaymentList,
  useUpdatePayment,
} from '@/modules/dental-management/presentation/hooks';

// eslint-disable-next-line react/function-component-definition
export default function PaymentsPage(): JSX.Element {
  const t = useTranslations('payment');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'payments', isCurrent: true, label: t(paymentConfig.title) },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <EntityList
              config={paymentConfig}
              fetchHook={usePaymentList}
              useCreate={useCreatePayment}
              useUpdate={useUpdatePayment}
              useDelete={useDeletePayment}
            />
          </div>
        </div>
      </div>
    </>
  );
}
