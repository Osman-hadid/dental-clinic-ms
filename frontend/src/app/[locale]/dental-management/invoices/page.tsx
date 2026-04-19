'use client';

import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InvoiceVisitSyncPanel } from '@/modules/dental-management/presentation/components/invoices/invoice-visit-sync-panel';
import { invoiceConfig } from '@/modules/dental-management/presentation/config/invoice-config';
import {
  useCreateInvoice,
  useDeleteInvoice,
  useInvoiceList,
  useUpdateInvoice,
} from '@/modules/dental-management/presentation/hooks';
import { DollarSign, FileText, Receipt } from 'lucide-react';

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
      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-6 overflow-x-hidden">
        <div className="rounded-3xl border border-border/60 bg-card/95 p-6 text-foreground shadow-lg">

          <div className="relative mb-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-emerald-200/50 bg-emerald-100/60 p-2.5 dark:border-emerald-400/20 dark:bg-emerald-500/16">
                <Receipt className="size-5 text-emerald-600 dark:text-emerald-300" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{t(invoiceConfig.title)}</h1>
                <p className="text-sm text-muted-foreground">Manage invoices and payments</p>
              </div>
            </div>
          </div>

          <div className="relative space-y-6">
            <Card className="min-w-0 rounded-2xl border border-border/50 bg-card shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-violet-200/50 bg-violet-100/60 p-2 dark:border-violet-400/20 dark:bg-violet-500/16">
                    <DollarSign className="size-4 text-violet-600 dark:text-violet-300" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Quick Invoice</CardTitle>
                    <CardDescription className="text-xs">
                      Create invoice from unpaid visits
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <InvoiceVisitSyncPanel />
              </CardContent>
            </Card>

            <Card className="min-w-0 rounded-2xl border border-border/50 bg-card shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-blue-200/50 bg-blue-100/60 p-2 dark:border-blue-400/20 dark:bg-blue-500/16">
                    <FileText className="size-4 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <CardTitle className="text-base">All Invoices</CardTitle>
                    <CardDescription className="text-xs">
                      View and manage invoice records
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <EntityList
                  config={invoiceConfig}
                  fetchHook={useInvoiceList}
                  useCreate={useCreateInvoice}
                  useUpdate={useUpdateInvoice}
                  useDelete={useDeleteInvoice}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
