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
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      <MetricCard label="Changes to financial records" value={data.summary.modificationCount} />
      <MetricCard label="Report views and downloads" value={data.summary.accessCount} />
      <MetricCard label="Saved report check-ins" value={data.summary.snapshotCount} />
      <MetricCard label="Backup health" value={data.summary.backupStatus} />
      <MetricCard label="Backup warnings" value={data.summary.healthWarningCount} />
      <MetricCard label="Failed backups (7d)" value={data.summary.failedBackupCount} />
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
                  <th className="px-3 py-2">Context</th>
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
                    <td className="px-3 py-2">{[row.actorRightLevel, row.actorRoles].filter(Boolean).join(' | ') || '-'}</td>
                    <td className="px-3 py-2">{row.changedBy}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No report activity was found for the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Operational health checks</CardTitle>
          <CardDescription>Quick admin-facing visibility into backup readiness, storage pressure, and system health.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>Last successful backup: {data.summary.lastSuccessfulBackupAt ? formatDateTime(data.summary.lastSuccessfulBackupAt, locale) : 'Never'}</span>
            <span>Low disk warning: {data.summary.lowDiskWarning ? 'Yes' : 'No'}</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Check</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.healthChecks.length > 0 ? data.healthChecks.map((row, index) => (
                  <tr key={`${row.label}-${index}`} className="border-t">
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <p>{row.label}</p>
                        <p className="text-xs text-muted-foreground">{row.details}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">{row.value}</td>
                    <td className="px-3 py-2">{row.action}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No operational health checks were available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Recent backup runs</CardTitle>
          <CardDescription>Track the latest backup jobs and quickly spot failures or stale restore points.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.recentBackups.length > 0 ? data.recentBackups.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">{row.completedAt ? formatDateTime(row.completedAt, locale) : '-'}</td>
                    <td className="px-3 py-2">{row.mode}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">{row.fileSizeBytes > 0 ? `${(row.fileSizeBytes / 1024).toFixed(1)} KB` : '-'}</td>
                    <td className="px-3 py-2">{row.notes || '-'}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No backup runs were found.</td>
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
