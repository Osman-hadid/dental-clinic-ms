'use client';

import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { invoiceConfig } from '@/modules/dental-management/presentation/config/invoice-config';
import {
  useCreateInvoice,
  useDeleteInvoice,
  useInvoiceList,
  useUpdateInvoice,
} from '@/modules/dental-management/presentation/hooks';
import { InvoiceVisitSyncPanel } from '@/modules/dental-management/presentation/components/invoices/invoice-visit-sync-panel';

// eslint-disable-next-line react/function-component-definition
export default function InvoicesPage(): JSX.Element {
  const t = useTranslations('invoice');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'invoices', isCurrent: true, label: t(invoiceConfig.title) },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-6 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <InvoiceVisitSyncPanel />
            <EntityList
              config={invoiceConfig}
              fetchHook={useInvoiceList}
              useCreate={useCreateInvoice}
              useUpdate={useUpdateInvoice}
              useDelete={useDeleteInvoice}
            />
          </div>
        </div>
      </div>
    </>
  );
}
