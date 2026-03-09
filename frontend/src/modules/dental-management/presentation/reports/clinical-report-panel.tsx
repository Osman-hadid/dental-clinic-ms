import { JSX } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/currency-utils';
import { ClinicalData, pieColors } from '@/modules/dental-management/presentation/reports/report-dashboard-types';
import { MetricCard } from '@/modules/dental-management/presentation/reports/report-dashboard-utils';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export const ClinicalReportPanel = ({ data }: { data: ClinicalData }): JSX.Element => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Appointments booked" value={data.summary.appointments} />
      <MetricCard label="Visits completed" value={data.summary.visits} />
      <MetricCard label="Treatments done" value={data.summary.visitTreatments} />
      <MetricCard label="Prescriptions given" value={data.summary.prescriptions} />
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Appointment results</CardTitle>
          <CardDescription>See how many appointments were completed, stayed pending, or were cancelled.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.charts.appointmentStatusBreakdown} dataKey="count" nameKey="status" outerRadius={100}>
                {data.charts.appointmentStatusBreakdown.map((entry, index) => (
                  <Cell key={`${entry.status}-${index}`} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Most common treatments</CardTitle>
          <CardDescription>These are the treatments performed most often during the selected period.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.treatmentVolume}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => Number(value)} />
              <Bar dataKey="sessions" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Implant work over time</CardTitle>
          <CardDescription>See how implant-related treatment volume changed during the selected period.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.charts.implantPlacementTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => Number(value)} />
              <Line type="monotone" dataKey="count" stroke="#0f766e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Dentist performance</CardTitle>
          <CardDescription>Compare visits and revenue by dentist for the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Dentist</th>
                  <th className="px-3 py-2">Visits</th>
                  <th className="px-3 py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.dentistPerformance.length > 0 ? data.tables.dentistPerformance.map((row, index) => (
                  <tr key={`${row.dentist ?? index}`} className="border-t">
                    <td className="px-3 py-2">{String(row.dentist ?? '-')}</td>
                    <td className="px-3 py-2">{Number(row.visits ?? 0)}</td>
                    <td className="px-3 py-2">{formatCurrency(Number(row.revenue ?? 0), 'AFN')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No dentist performance data was found for the selected filters.</td>
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
          <CardTitle>Recent prescriptions</CardTitle>
          <CardDescription>A quick view of medicines linked to patient visits and treatments.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Medicine</th>
                  <th className="px-3 py-2">Treatment</th>
                  <th className="px-3 py-2">Visit Date</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.prescriptions.length > 0 ? data.tables.prescriptions.map((row, index) => (
                  <tr
                    key={`${String(row.createdAt ?? 'prescription')}-${String(row.patientName ?? 'patient')}-${String(row.medicineName ?? 'medicine')}-${index}`}
                    className="border-t"
                  >
                    <td className="px-3 py-2">{String(row.patientName ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.medicineName ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.treatmentName ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.visitDate ?? '-')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No prescriptions were found for the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Implant follow-up</CardTitle>
          <CardDescription>Check implant cases, their current availability, and remaining supplier balance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Tooth</th>
                  <th className="px-3 py-2">Availability</th>
                  <th className="px-3 py-2">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.implantCases.length > 0 ? data.tables.implantCases.map((row, index) => (
                  <tr
                    key={`${String(row.updatedAt ?? 'implant')}-${String(row.patientName ?? 'patient')}-${String(row.toothNumber ?? 'tooth')}-${index}`}
                    className="border-t"
                  >
                    <td className="px-3 py-2">{String(row.patientName ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.toothNumber ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.availability ?? '-')}</td>
                    <td className="px-3 py-2">{Number(row.supplierRemaining ?? 0)}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No implant cases were found for the selected filters.</td>
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
