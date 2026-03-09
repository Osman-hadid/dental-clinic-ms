import { JSX } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/currency-utils';
import { ExecutiveData, SnapshotCadence, SnapshotRecord, SnapshotScheduleResponse } from '@/modules/dental-management/presentation/reports/report-dashboard-types';
import { MetricCard, formatDateTime } from '@/modules/dental-management/presentation/reports/report-dashboard-utils';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Props = {
  data: ExecutiveData;
  isSavingSchedule: boolean;
  isSavingSnapshot: boolean;
  locale: string;
  onCaptureSnapshot: () => void;
  onScheduleChange: (cadence: SnapshotCadence) => void;
  onSaveSchedule: () => void;
  schedule: SnapshotScheduleResponse | null;
  snapshots: SnapshotRecord[];
};

export const ExecutiveReportPanel = ({
  data,
  isSavingSchedule,
  isSavingSnapshot,
  locale,
  onCaptureSnapshot,
  onScheduleChange,
  onSaveSchedule,
  schedule,
  snapshots,
}: Props): JSX.Element => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard
        emphasize
        label="Money in safe now"
        tone="safe"
        value={formatCurrency(data.cashInSafe ?? 0, 'AFN')}
      />
      <MetricCard
        emphasize
        label="Total unpaid money"
        tone="danger"
        value={formatCurrency(data.kpis?.debt ?? 0, 'AFN')}
      />
      <MetricCard
        emphasize
        label="Profit after costs"
        value={formatCurrency(data.profitLoss ?? 0, 'AFN')}
      />
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Total billed to patients" value={formatCurrency(data.kpis?.billed ?? 0, 'AFN')} />
      <MetricCard label="Money received" value={formatCurrency(data.kpis?.paid ?? 0, 'AFN')} />
      <MetricCard label="Money in bank" value={formatCurrency(data.bankBalance ?? 0, 'AFN')} />
      <MetricCard label="New Patients" value={data.newPatientsCount ?? 0} />
      <MetricCard label="Patients who accepted treatment" value={`${data.treatmentAcceptanceRate ?? 0}%`} />
      <MetricCard label="Chair use rate" value={`${data.chairUtilizationRate ?? 0}%`} />
      <MetricCard label="Implant revenue" value={formatCurrency(data.implantRevenue ?? 0, 'AFN')} />
      <MetricCard label="Clinical spending" value={formatCurrency(data.expenseSummary.clinical ?? 0, 'AFN')} />
      <MetricCard label="Daily spending" value={formatCurrency(data.expenseSummary.daily ?? 0, 'AFN')} />
    </div>

    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Money received over time</CardTitle>
          <CardDescription>Use this to see whether clinic income is rising, falling, or staying stable.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.revenueTrendMonthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value), 'AFN')} />
              <Area type="monotone" dataKey="amount" stroke="#0f766e" fill="#99f6e4" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Profit after costs over time</CardTitle>
          <CardDescription>This shows how much money remained after expenses in each period.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.profitLossTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value), 'AFN')} />
              <Line type="monotone" dataKey="profit" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Most important treatments</CardTitle>
          <CardDescription>The treatments below brought the most activity and income in the selected time.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Treatment</th>
                  <th className="px-3 py-2">Sessions</th>
                  <th className="px-3 py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.treatmentVolume.length > 0 ? data.treatmentVolume.slice(0, 10).map((row) => (
                  <tr key={row.name} className="border-t">
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.sessions}</td>
                    <td className="px-3 py-2">{formatCurrency(row.revenue, 'AFN')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No treatment activity was found for the selected filters.</td>
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
          <CardTitle>Income by dentist</CardTitle>
          <CardDescription>Compare dentist visits and revenue without leaving the overview page.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.dentistProductivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dentist" />
              <YAxis />
              <Tooltip formatter={(value, name) => name === 'revenue' ? formatCurrency(Number(value), 'AFN') : Number(value)} />
              <Bar dataKey="revenue" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Expense summary</CardTitle>
          <CardDescription>See which cost categories are taking the biggest share of clinic spending.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.expenseSummary.byCategory.length > 0 ? data.expenseSummary.byCategory.slice(0, 8).map((row, index) => (
                  <tr key={`${row.category}-${index}`} className="border-t">
                    <td className="px-3 py-2">{row.category}</td>
                    <td className="px-3 py-2">{formatCurrency(row.amount, 'AFN')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">No expense summary was found for the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Saved check-ins</CardTitle>
          <CardDescription>Save a quick copy of this clinic summary so you can compare it later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Automatic save</label>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={schedule?.cadence ?? 'off'}
              onChange={(event) => onScheduleChange(event.target.value as SnapshotCadence)}
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={onCaptureSnapshot} disabled={isSavingSnapshot}>
              {isSavingSnapshot ? 'Saving...' : 'Save this summary'}
            </Button>
            <Button type="button" variant="outline" onClick={onSaveSchedule} disabled={isSavingSchedule || !schedule}>
              {isSavingSchedule ? 'Saving...' : 'Save automatic setting'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Last automatic save: {schedule?.lastRunAt ? formatDateTime(schedule.lastRunAt, locale) : 'Never'}
          </p>
          <div className="space-y-2">
            {snapshots.slice(0, 5).map((snapshot) => (
              <div key={snapshot.id} className="rounded-xl border bg-muted/20 p-3 text-sm">
                <p className="font-medium">{formatDateTime(snapshot.capturedAt, locale)}</p>
                <p className="text-muted-foreground">
                  Billed {formatCurrency(snapshot.payload.kpis?.billed ?? 0, 'AFN')} | Received {formatCurrency(snapshot.payload.kpis?.paid ?? 0, 'AFN')} | Unpaid {formatCurrency(snapshot.payload.kpis?.debt ?? 0, 'AFN')}
                </p>
              </div>
            ))}
            {snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved check-ins yet for this report.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);
