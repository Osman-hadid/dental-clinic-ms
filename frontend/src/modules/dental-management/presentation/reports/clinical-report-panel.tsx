import { JSX } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/currency-utils';
import { ClinicalData, pieColors } from '@/modules/dental-management/presentation/reports/report-dashboard-types';
import { MetricCard } from '@/modules/dental-management/presentation/reports/report-dashboard-utils';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const formatTimelineDate = (value: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const hasTime = value.includes('T') || value.includes(':');

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    ...(hasTime ? { timeStyle: 'short' } : {}),
  }).format(parsed);
};

export const ClinicalReportPanel = ({ data }: { data: ClinicalData }): JSX.Element => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-8">
      <MetricCard label="Appointments booked" value={data.summary.appointments} />
      <MetricCard label="Visits completed" value={data.summary.visits} />
      <MetricCard label="Treatments done" value={data.summary.visitTreatments} />
      <MetricCard label="Treatments corrected" value={data.summary.correctedTreatments} />
      <MetricCard label="Prescriptions given" value={data.summary.prescriptions} />
      <MetricCard label="Waiting now" value={data.summary.waitingAppointments} />
      <MetricCard label="In chair" value={data.summary.inChairAppointments} />
      <MetricCard label="Late arrivals" value={data.summary.lateAppointments} />
      <MetricCard label="Timeline events" value={data.summary.timelineEvents} />
      <MetricCard label="Patients with activity" value={data.summary.timelinePatients} />
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

    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Queue snapshot</CardTitle>
          <CardDescription>Review waiting-room progress, chair occupancy, and late arrivals inside the report period.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Dentist</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.queueSnapshot.length > 0 ? data.tables.queueSnapshot.map((row, index) => (
                  <tr
                    key={`${String(row.scheduledAt ?? 'queue')}-${String(row.patientName ?? 'patient')}-${index}`}
                    className="border-t"
                  >
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <p>{String(row.patientName ?? '-')}</p>
                        <p className="text-xs text-muted-foreground">{String(row.appointmentTag ?? '-')}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2">{String(row.dentistName ?? '-')}</td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <p>{String(row.date ?? '-')}</p>
                        <p className="text-xs text-muted-foreground">{String(row.timeRange ?? '-')}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <p>{String(row.status ?? '-')}</p>
                        {Boolean(row.late) ? <p className="text-xs text-amber-700">Late arrival</p> : null}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No queue activity was found for the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border xl:col-span-2">
        <CardHeader>
          <CardTitle>Recent patient journey</CardTitle>
          <CardDescription>Review the latest appointments, visits, treatments, invoices, payments, and tasks in one report table.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.patientTimeline.length > 0 ? data.tables.patientTimeline.map((row, index) => (
                  <tr
                    key={`${String(row.occurredAt ?? 'timeline')}-${String(row.patientName ?? 'patient')}-${String(row.eventType ?? 'event')}-${String(row.details ?? 'details')}-${index}`}
                    className="border-t"
                  >
                    <td className="px-3 py-2">{formatTimelineDate(String(row.occurredAt ?? '-'))}</td>
                    <td className="px-3 py-2">{String(row.patientName ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.eventLabel ?? row.eventType ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.details ?? '-')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No patient journey events were found for the selected filters.</td>
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
          <CardTitle>Treatment correction history</CardTitle>
          <CardDescription>Recent treatment edits with reason, editor, and the fields that changed.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Treatment</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Changed</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.treatmentCorrections.length > 0 ? data.tables.treatmentCorrections.map((row, index) => (
                  <tr
                    key={`${String(row.changedAt ?? 'correction')}-${String(row.treatmentName ?? 'treatment')}-${index}`}
                    className="border-t"
                  >
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <p>{formatTimelineDate(String(row.changedAt ?? '-'))}</p>
                        <p className="text-xs text-muted-foreground">{String(row.changedBy ?? '-')}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2">{String(row.patientName ?? '-')}</td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <p>{String(row.treatmentName ?? '-')}</p>
                        <p className="text-xs text-muted-foreground">{String(row.visitLabel ?? '-')}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2">{String(row.correctionReason ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.changeSummary ?? '-')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No treatment corrections were found for the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
