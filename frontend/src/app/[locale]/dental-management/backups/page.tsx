'use client';

import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { InvoiceBackupDropdownPanel } from '@/modules/dental-management/presentation/components/invoices/invoice-backup-dropdown-panel';

// eslint-disable-next-line react/function-component-definition
export default function DentalBackupsPage(): JSX.Element {
  const tSidebar = useTranslations('sidebar');
  const tBackup = useTranslations('sidebar.backupManagement');

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('dentalManagement.title') },
          { id: 'backups', isCurrent: true, label: tBackup('backups') },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-6 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <InvoiceBackupDropdownPanel />
          </div>
        </div>
      </div>
    </>
  );
}
