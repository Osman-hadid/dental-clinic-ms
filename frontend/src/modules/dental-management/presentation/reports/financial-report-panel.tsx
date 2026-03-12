import { JSX } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/currency-utils';
import { FinancialData, pieColors } from '@/modules/dental-management/presentation/reports/report-dashboard-types';
import { MetricCard } from '@/modules/dental-management/presentation/reports/report-dashboard-utils';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export const FinancialReportPanel = ({ data }: { data: FinancialData }): JSX.Element => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-5">
      <MetricCard
        emphasize
        label="Money in safe now"
        tone="safe"
        value={formatCurrency(data.summary.safeBalance, 'AFN')}
      />
      <MetricCard
        emphasize
        label="Total Debts"
        tone="danger"
        value={formatCurrency(data.summary.outstanding, 'AFN')}
      />
      <MetricCard
        emphasize
        label="Total unpaid money"
        tone="danger"
        value={formatCurrency(data.summary.thirdCompanyUnpaid, 'AFN')}
      />
      <MetricCard
        emphasize
        label="Total third company paid"
        value={formatCurrency(data.summary.thirdCompanyPaid ?? 0, 'AFN')}
      />
      <MetricCard
        emphasize
        label="Cash taken from safe"
        tone="danger"
        value={formatCurrency(data.summary.safeOut, 'AFN')}
      />
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Total billed to patients" value={formatCurrency(data.summary.billed, 'AFN')} />
      <MetricCard label="Money received" value={formatCurrency(data.summary.paid, 'AFN')} />
      <MetricCard label="Clinic costs" value={formatCurrency(data.summary.expenses, 'AFN')} />
      <MetricCard label="Cash added to safe" value={formatCurrency(data.summary.safeIn, 'AFN')} />
      <MetricCard label="Share of bills collected" value={`${data.summary.collectionRate}%`} />
      <MetricCard label="Net after costs" value={formatCurrency(data.summary.net, 'AFN')} />
      <MetricCard label="Shareholder contribution" value={formatCurrency(data.summary.shareholderContribution, 'AFN')} />
      <MetricCard label="Shareholder distribution" value={formatCurrency(data.summary.shareholderDistribution, 'AFN')} />
      <MetricCard label="Salaries paid" value={formatCurrency(data.summary.salaryPaid, 'AFN')} />
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Income over time</CardTitle>
          <CardDescription>Track how much money came into the clinic during the selected period.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.charts.revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value), 'AFN')} />
              <Area type="monotone" dataKey="amount" stroke="#16a34a" fill="#bbf7d0" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Cash in and cash out</CardTitle>
          <CardDescription>Green bars show money entering the clinic. Red bars show money leaving it.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.safeFlow}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value), 'AFN')} />
              <Bar dataKey="in" fill="#16a34a" radius={[6, 6, 0, 0]} />
              <Bar dataKey="out" fill="#dc2626" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>How patients paid</CardTitle>
          <CardDescription>See which payment methods brought in the most money.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.charts.paymentMethodMix} dataKey="amount" nameKey="method" outerRadius={100}>
                {data.charts.paymentMethodMix.map((entry, index) => (
                  <Cell key={`${entry.method}-${index}`} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value), 'AFN')} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Expenses by category</CardTitle>
          <CardDescription>Compare the biggest areas where clinic money was spent.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.expenseByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value), 'AFN')} />
              <Bar dataKey="amount" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Patients who still owe money</CardTitle>
          <CardDescription>These invoices still have an unpaid balance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Debt</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.outstandingInvoices.length > 0 ? data.tables.outstandingInvoices.map((row, index) => (
                  <tr key={`${row.invoiceId ?? index}`} className="border-t">
                    <td className="px-3 py-2">#{String(row.invoiceId ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.patientName ?? '-')}</td>
                    <td className="px-3 py-2">{formatCurrency(Number(row.debtAmount ?? 0), 'AFN')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No unpaid invoices matched the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Income by treatment</CardTitle>
          <CardDescription>See which treatments brought the most activity and money.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Treatment</th>
                  <th className="px-3 py-2">Sessions</th>
                  <th className="px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.revenueByTreatment.length > 0 ? data.tables.revenueByTreatment.map((row, index) => (
                  <tr key={`${row.name ?? index}`} className="border-t">
                    <td className="px-3 py-2">{String(row.name ?? '-')}</td>
                    <td className="px-3 py-2">{Number(row.sessions ?? 0)}</td>
                    <td className="px-3 py-2">{formatCurrency(Number(row.amount ?? 0), 'AFN')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No treatment income data was found for the selected filters.</td>
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
          <CardDescription>Compare how much revenue each dentist generated in the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Dentist</th>
                  <th className="px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.revenueByDentist.length > 0 ? data.tables.revenueByDentist.map((row, index) => (
                  <tr key={`${row.dentist ?? index}`} className="border-t">
                    <td className="px-3 py-2">{String(row.dentist ?? '-')}</td>
                    <td className="px-3 py-2">{formatCurrency(Number(row.amount ?? 0), 'AFN')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">No dentist revenue data was found for the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Recent safe activity</CardTitle>
          <CardDescription>Keep the latest money-in and money-out movements visible inside the main report.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Direction</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.safeLedger.length > 0 ? data.tables.safeLedger.slice(0, 8).map((row, index) => (
                  <tr
                    key={`${String(row.transactionDate ?? 'date')}-${String(row.entryType ?? 'entry')}-${String(row.direction ?? 'direction')}-${String(row.amount ?? 0)}-${index}`}
                    className="border-t"
                  >
                    <td className="px-3 py-2">{String(row.transactionDate ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.direction ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.entryType ?? '-')}</td>
                    <td className={`px-3 py-2 font-medium ${String(row.direction ?? '') === 'out' ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {formatCurrency(Number(row.amount ?? 0), 'AFN')}
                    </td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No safe activity was found for the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Implant company records</CardTitle>
          <CardDescription>Supplier costs grouped by implant company and implant type.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Implant Type</th>
                  <th className="px-3 py-2">Teeth</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Paid</th>
                  <th className="px-3 py-2">Unpaid</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.implantCompanyRecords.length > 0 ? data.tables.implantCompanyRecords.map((row, index) => (
                  <tr key={`${String(row.companyId ?? 'company')}-${index}`} className="border-t">
                    <td className="px-3 py-2 font-medium">{String(row.companyName ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.implantType ?? '-')}</td>
                    <td className="px-3 py-2">{Number(row.implantCount ?? 0)}</td>
                    <td className="px-3 py-2">{formatCurrency(Number(row.supplierTotal ?? 0), 'AFN')}</td>
                    <td className="px-3 py-2 text-emerald-700">{formatCurrency(Number(row.supplierPaid ?? 0), 'AFN')}</td>
                    <td className="px-3 py-2 text-rose-600">{formatCurrency(Number(row.supplierRemaining ?? 0), 'AFN')}</td>
                    <td className="px-3 py-2">{String(row.recordDate ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.note ?? '-')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      No implant company records matched the selected filters.
                    </td>
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
