import { JSX } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/currency-utils';
import { InventoryData, pieColors } from '@/modules/dental-management/presentation/reports/report-dashboard-types';
import { MetricCard } from '@/modules/dental-management/presentation/reports/report-dashboard-utils';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export const InventoryReportPanel = ({ data }: { data: InventoryData }): JSX.Element => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Items in inventory" value={data.summary.totalItems} />
      <MetricCard label="Total units in stock" value={data.summary.totalQuantity} />
      <MetricCard label="Estimated stock value" value={formatCurrency(data.summary.totalValue, 'AFN')} />
      <MetricCard label="Running low / out of stock" value={`${data.summary.lowStockCount} / ${data.summary.outOfStockCount}`} />
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Stock health</CardTitle>
          <CardDescription>See how many items are available, running low, or completely out of stock.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.charts.availabilityBreakdown} dataKey="count" nameKey="status" outerRadius={100}>
                {data.charts.availabilityBreakdown.map((entry, index) => (
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
          <CardTitle>Supplies used by treatment</CardTitle>
          <CardDescription>This shows which treatments are consuming the most items.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.usageByTreatment}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="treatmentName" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="quantityUsed" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Items by category</CardTitle>
          <CardDescription>See which supply categories make up most of the current stock.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.charts.categoryBreakdown} dataKey="count" nameKey="category" outerRadius={100}>
                {data.charts.categoryBreakdown.map((entry, index) => (
                  <Cell key={`${entry.category}-${index}`} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Implant stock</CardTitle>
          <CardDescription>Keep implant-specific inventory visible without leaving the main report.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.implantStockRows.length > 0 ? data.tables.implantStockRows.slice(0, 8).map((row, index) => (
                  <tr key={`${String(row.id ?? row.itemName ?? 'implant')}-${index}`} className="border-t">
                    <td className="px-3 py-2">{String(row.itemName ?? '-')}</td>
                    <td className="px-3 py-2">{Number(row.availableQuantity ?? 0)}</td>
                    <td className="px-3 py-2">{String(row.supplier ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.availability ?? '-')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No implant stock rows were found for the selected filters.</td>
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
          <CardTitle>Current stock list</CardTitle>
          <CardDescription>Review each item, how much is left, and whether it needs attention.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.stockRows.length > 0 ? data.tables.stockRows.map((row, index) => (
                  <tr key={`${String(row.id ?? row.itemName ?? 'stock')}-${String(row.availability ?? 'status')}-${index}`} className="border-t">
                    <td className="px-3 py-2">{String(row.itemName ?? '-')}</td>
                    <td className="px-3 py-2">{Number(row.availableQuantity ?? 0)}</td>
                    <td className="px-3 py-2">{String(row.availability ?? '-')}</td>
                    <td className="px-3 py-2">{formatCurrency(Number(row.stockValue ?? 0), 'AFN')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No stock items matched the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader>
          <CardTitle>Recent item usage</CardTitle>
          <CardDescription>Follow where supplies were used and which patient treatment they were linked to.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Treatment</th>
                  <th className="px-3 py-2">Used</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.usageRows.length > 0 ? data.tables.usageRows.map((row, index) => (
                  <tr key={`${String(row.inventoryItemId ?? row.itemName ?? 'usage')}-${String(row.patientName ?? 'patient')}-${String(row.treatmentName ?? 'treatment')}-${index}`} className="border-t">
                    <td className="px-3 py-2">{String(row.itemName ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.patientName ?? '-')}</td>
                    <td className="px-3 py-2">{String(row.treatmentName ?? '-')}</td>
                    <td className="px-3 py-2">{Number(row.quantityUsed ?? 0)} {String(row.unit ?? '')}</td>
                  </tr>
                )) : (
                  <tr className="border-t">
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No usage records were found for the selected filters.</td>
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
