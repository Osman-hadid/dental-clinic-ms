import { JSX } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuditData } from '@/modules/dental-management/presentation/reports/report-dashboard-types';
import { MetricCard, formatDateTime } from '@/modules/dental-management/presentation/reports/report-dashboard-utils';

type Props = {
  data: AuditData;
  locale: string;
};

export const AuditReportPanel = ({ data, locale }: Props): JSX.Element => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard label="Changes to financial records" value={data.summary.modificationCount} />
      <MetricCard label="Report views and downloads" value={data.summary.accessCount} />
      <MetricCard label="Saved report check-ins" value={data.summary.snapshotCount} />
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Changes to financial records</CardTitle>
          <CardDescription>Review when key financial records were changed and who made the change.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">By</th>
                </tr>
              </thead>
              <tbody>
                {data.financialModifications.length > 0 ? data.financialModifications.map((row, index) => (
                  <tr key={`${row.timestamp}-${index}`} className="border-t">
                    <td className="px-3 py-2">{formatDateTime(row.timestamp, locale)}</td>
                    <td className="px-3 py-2">{row.entity}</td>
                    <td className="px-3 py-2">{row.action}</td>
                    <td className="px-3 py-2">{row.changedBy}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No financial changes were found for the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Report activity history</CardTitle>
          <CardDescription>See when reports were opened, exported, or saved and who performed the action.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">By</th>
                </tr>
              </thead>
              <tbody>
                {data.timeline.length > 0 ? data.timeline.map((row, index) => (
                  <tr key={`${row.timestamp}-${index}`} className="border-t">
                    <td className="px-3 py-2">{formatDateTime(row.timestamp, locale)}</td>
                    <td className="px-3 py-2">{row.type}</td>
                    <td className="px-3 py-2">{row.entity}</td>
                    <td className="px-3 py-2">{row.action}</td>
                    <td className="px-3 py-2">{row.changedBy}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No report activity was found for the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);
