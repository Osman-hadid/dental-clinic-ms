'use client';

import { JSX, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AxiosClient } from '@/modules/common/infrastructure/api/axios-client';
import { toast } from 'sonner';

type InventoryCategory = 'consumable' | 'implant' | 'instrument' | 'medicine' | 'other' | 'ppe';
type InventoryUnit = 'box' | 'bottle' | 'kit' | 'pack' | 'pair' | 'piece' | 'set' | 'tube' | 'unit';
type InventoryAcquisitionSource = 'previous_stock' | 'purchase';
type StockFilter = 'all' | 'in_stock' | 'low' | 'out';

type InventoryItem = {
  acquisitionSource: InventoryAcquisitionSource;
  category: InventoryCategory;
  entryDate: string;
  expiryDate: string;
  id: string;
  itemName: string;
  location: string;
  lotNumber: string;
  minStock: number;
  notes: string;
  quantity: number;
  supplier: string;
  totalCost: number;
  unit: InventoryUnit;
  unitCost: number;
};

type InventoryFormState = {
  acquisitionSource: InventoryAcquisitionSource;
  category: InventoryCategory;
  entryDate: string;
  expiryDate: string;
  hasExpiryDate: boolean;
  itemName: string;
  location: string;
  lotNumber: string;
  minStock: string;
  notes: string;
  quantity: string;
  supplier: string;
  unit: InventoryUnit;
  unitCost: string;
};

type PaginatedRowsResponse = {
  data?: Array<Record<string, unknown>>;
  meta?: { currentPage?: number; lastPage?: number };
};

const apiClient = new AxiosClient();
const API_MAX_PER_PAGE = 100;

const CATEGORY_OPTIONS: Array<{ label: string; value: InventoryCategory }> = [
  { label: 'Consumable', value: 'consumable' },
  { label: 'Medicine', value: 'medicine' },
  { label: 'Instrument', value: 'instrument' },
  { label: 'Implant', value: 'implant' },
  { label: 'PPE', value: 'ppe' },
  { label: 'Other', value: 'other' },
];
const SOURCE_OPTIONS: Array<{ label: string; value: InventoryAcquisitionSource }> = [
  { label: 'Previous Stock (No Safe Impact)', value: 'previous_stock' },
  { label: 'Purchase (Cut From Safe)', value: 'purchase' },
];
const UNIT_OPTIONS: Array<{ label: string; value: InventoryUnit }> = [
  { label: 'Piece', value: 'piece' }, { label: 'Box', value: 'box' }, { label: 'Pack', value: 'pack' },
  { label: 'Bottle', value: 'bottle' }, { label: 'Tube', value: 'tube' }, { label: 'Set', value: 'set' },
  { label: 'Kit', value: 'kit' }, { label: 'Pair', value: 'pair' }, { label: 'Unit', value: 'unit' },
];

const asText = (value: unknown): string => (typeof value === 'number' ? String(value).trim() : typeof value === 'string' ? value.trim() : '');
const asNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(asText(value));
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeText = (value: string): string => value.trim().toLowerCase();
const toInputDate = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatMoney = (value: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AFN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const normalizeSource = (value: unknown): InventoryAcquisitionSource => (asText(value) === 'purchase' ? 'purchase' : 'previous_stock');
const normalizeCategory = (value: unknown): InventoryCategory => {
  const raw = asText(value);
  return (['consumable', 'medicine', 'instrument', 'implant', 'ppe', 'other'] as const).includes(raw as InventoryCategory) ? raw as InventoryCategory : 'other';
};
const normalizeUnit = (value: unknown): InventoryUnit => {
  const raw = asText(value);
  return (['piece', 'box', 'pack', 'bottle', 'tube', 'set', 'kit', 'pair', 'unit'] as const).includes(raw as InventoryUnit) ? raw as InventoryUnit : 'piece';
};

const getStockState = (item: InventoryItem): 'in_stock' | 'low' | 'out' => (item.quantity <= 0 ? 'out' : item.quantity <= item.minStock ? 'low' : 'in_stock');
const isExpiringSoon = (expiryDate: string): boolean => {
  if (!expiryDate) return false;
  const now = new Date(toInputDate(new Date()));
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;
  const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return days >= 0 && days <= 30;
};

const emptyForm = (): InventoryFormState => ({
  acquisitionSource: 'previous_stock',
  category: 'consumable',
  entryDate: toInputDate(new Date()),
  expiryDate: '',
  hasExpiryDate: false,
  itemName: '',
  location: '',
  lotNumber: '',
  minStock: '5',
  notes: '',
  quantity: '',
  supplier: '',
  unit: 'piece',
  unitCost: '',
});

const extractApiErrorMessage = (error: unknown, fallback: string): string => {
  const payload = (error as { response?: { data?: { error?: { code?: string; details?: Record<string, unknown>; message?: string } } } })?.response?.data?.error;
  if (payload?.code === 'SAFE_BALANCE_INSUFFICIENT') {
    return `Safe balance is not enough. Current: ${formatMoney(Number(payload?.details?.currentBalance ?? 0))}. Requested: ${formatMoney(Number(payload?.details?.requestedAmount ?? 0))}.`;
  }
  return payload?.message || fallback;
};

const toInventoryItem = (row: Record<string, unknown>): InventoryItem => {
  const quantity = asNumber(row.quantity);
  const unitCost = asNumber(row.unitCost ?? row.unit_cost);
  const totalCost = asNumber(row.totalCost ?? row.total_cost) || (quantity * unitCost);
  return {
    acquisitionSource: normalizeSource(row.acquisitionSource ?? row.acquisition_source),
    category: normalizeCategory(row.category),
    entryDate: asText(row.entryDate ?? row.entry_date),
    expiryDate: asText(row.expiryDate ?? row.expiry_date),
    id: asText(row.id),
    itemName: asText(row.itemName ?? row.item_name),
    location: asText(row.location),
    lotNumber: asText(row.lotNumber ?? row.lot_number),
    minStock: asNumber(row.minStock ?? row.min_stock),
    notes: asText(row.notes),
    quantity,
    supplier: asText(row.supplier),
    totalCost,
    unit: normalizeUnit(row.unit),
    unitCost,
  };
};

// eslint-disable-next-line react/function-component-definition
export default function InventoryManagementPage(): JSX.Element {
  const tInventory = useTranslations('sidebar.inventoryManagement');

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<InventoryFormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | InventoryCategory>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');

  const fetchAllRows = useCallback(async (): Promise<Array<Record<string, unknown>>> => {
    const rows: Array<Record<string, unknown>> = [];
    let page = 1;
    while (true) {
      const response = await apiClient.get<PaginatedRowsResponse>('/api/v1/dental-management/inventory-items', {
        params: { page, perPage: API_MAX_PER_PAGE, sortBy: 'entryDate', sortDirection: 'desc' },
      });
      const payload = response.data;
      const pageRows = Array.isArray(payload?.data) ? payload.data : [];
      rows.push(...pageRows);
      const currentPage = Number(payload?.meta?.currentPage ?? page);
      const lastPage = Number(payload?.meta?.lastPage ?? currentPage);
      if (pageRows.length === 0 || currentPage >= lastPage) break;
      page += 1;
    }
    return rows;
  }, []);

  const fetchData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const rows = await fetchAllRows();
      setItems(rows.map((row) => toInventoryItem(row)));
    } catch (error: unknown) {
      toast.error(extractApiErrorMessage(error, 'Failed to fetch inventory items.'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllRows]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const filteredItems = useMemo(() => {
    const query = normalizeText(search);
    return items
      .filter((item) => {
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (stockFilter !== 'all' && getStockState(item) !== stockFilter) return false;
        if (!query) return true;
        const blob = normalizeText([item.entryDate, item.itemName, item.category, item.supplier, item.location, item.lotNumber, item.notes].join(' '));
        return blob.includes(query);
      })
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  }, [categoryFilter, items, search, stockFilter]);

  const summary = useMemo(() => ({
    totalQty: items.reduce((sum, i) => sum + i.quantity, 0),
    totalValue: items.reduce((sum, i) => sum + i.totalCost, 0),
    lowStockCount: items.filter((i) => getStockState(i) === 'low').length,
    outStockCount: items.filter((i) => getStockState(i) === 'out').length,
    expiringSoonCount: items.filter((i) => isExpiringSoon(i.expiryDate)).length,
  }), [items]);

  const resetForm = (): void => { setForm(emptyForm()); setEditingId(null); setFormError(''); };

  const saveItem = async (): Promise<void> => {
    if (isSaving) return;
    const name = form.itemName.trim();
    const quantity = asNumber(form.quantity);
    const minStock = asNumber(form.minStock);
    const unitCost = asNumber(form.unitCost);
    if (!name) return setFormError('Item name is required.');
    if (quantity < 0 || minStock < 0 || unitCost < 0) return setFormError('Quantity, minimum stock, and unit cost must be zero or greater.');
    if (form.acquisitionSource === 'purchase' && quantity * unitCost <= 0) return setFormError('For purchased items, quantity and unit cost must be greater than 0.');
    if (form.hasExpiryDate && !form.expiryDate) return setFormError('Select an expiry date or disable expiry for this item.');

    setFormError('');
    setIsSaving(true);
    const payload = {
      acquisitionSource: form.acquisitionSource,
      entryDate: form.entryDate || toInputDate(new Date()),
      itemName: name,
      category: form.category,
      quantity,
      unit: form.unit,
      minStock,
      unitCost,
      supplier: form.supplier.trim() || null,
      lotNumber: form.lotNumber.trim() || null,
      expiryDate: form.hasExpiryDate ? (form.expiryDate || null) : null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
    };

    try {
      if (editingId) {
        const res = await apiClient.put(`/api/v1/dental-management/inventory-items/${editingId}`, payload);
        if (!res.success) return setFormError(res.error?.message || 'Failed to update inventory item.');
        toast.success('Inventory item updated.');
      } else {
        const res = await apiClient.post('/api/v1/dental-management/inventory-items', payload);
        if (!res.success) return setFormError(res.error?.message || 'Failed to save inventory item.');
        toast.success('Inventory item saved.');
        if (form.acquisitionSource === 'purchase') toast.success('Safe balance was updated for this purchase.');
      }
      await fetchData();
      resetForm();
    } catch (error: unknown) {
      setFormError(extractApiErrorMessage(error, 'Failed to save inventory item.'));
    } finally {
      setIsSaving(false);
    }
  };

  const editItem = (item: InventoryItem): void => {
    setEditingId(item.id);
    setFormError('');
    setForm({
      acquisitionSource: item.acquisitionSource,
      category: item.category,
      entryDate: item.entryDate || toInputDate(new Date()),
      expiryDate: item.expiryDate,
      hasExpiryDate: Boolean(item.expiryDate),
      itemName: item.itemName,
      location: item.location,
      lotNumber: item.lotNumber,
      minStock: String(item.minStock),
      notes: item.notes,
      quantity: String(item.quantity),
      supplier: item.supplier,
      unit: item.unit,
      unitCost: String(item.unitCost),
    });
  };

  const deleteItem = async (id: string): Promise<void> => {
    try {
      const res = await apiClient.delete(`/api/v1/dental-management/inventory-items/${id}`);
      if (!res.success) {
        toast.error(res.error?.message || 'Failed to delete inventory item.');
        return;
      }
      toast.success('Inventory item deleted.');
      await fetchData();
      if (editingId === id) resetForm();
    } catch (error: unknown) {
      toast.error(extractApiErrorMessage(error, 'Failed to delete inventory item.'));
    }
  };

  return (
    <>
      <Header breadcrumbs={[{ id: 'inventoryManagement', label: tInventory('title') }, { id: 'inventory', isCurrent: true, label: tInventory('inventory') }]} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
            <div className="rounded-2xl border bg-gradient-to-r from-background to-muted/40 p-4">
              <h2 className="text-base font-semibold">Clinic Inventory Register</h2>
              <p className="text-xs text-muted-foreground">Purchase source cuts safe balance. Previous stock does not affect safe.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Card className="pt-3"><CardHeader className="pb-1"><CardDescription>Total Stock Units</CardDescription><CardTitle className="text-2xl">{summary.totalQty}</CardTitle></CardHeader></Card>
              <Card className="pt-3"><CardHeader className="pb-1"><CardDescription>Inventory Value</CardDescription><CardTitle className="text-2xl">{formatMoney(summary.totalValue)}</CardTitle></CardHeader></Card>
              <Card className="pt-3"><CardHeader className="pb-1"><CardDescription>Low Stock</CardDescription><CardTitle className="text-2xl text-amber-600">{summary.lowStockCount}</CardTitle></CardHeader></Card>
              <Card className="pt-3"><CardHeader className="pb-1"><CardDescription>Out of Stock</CardDescription><CardTitle className="text-2xl text-rose-600">{summary.outStockCount}</CardTitle></CardHeader></Card>
              <Card className="pt-3"><CardHeader className="pb-1"><CardDescription>Expiring in 30 Days</CardDescription><CardTitle className="text-2xl text-orange-600">{summary.expiringSoonCount}</CardTitle></CardHeader></Card>
            </div>

            <Card className="pt-7"><CardHeader><CardTitle>{editingId ? 'Edit Inventory Item' : 'Add Inventory Item'}</CardTitle><CardDescription>Save full details for each clinic item.</CardDescription></CardHeader><CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Input type="date" value={form.entryDate} onChange={(e) => setForm((s) => ({ ...s, entryDate: e.target.value }))} />
                <Input placeholder="Item name" value={form.itemName} onChange={(e) => setForm((s) => ({ ...s, itemName: e.target.value }))} />
                <Select value={form.acquisitionSource} onValueChange={(v) => (v === 'previous_stock' || v === 'purchase') && setForm((s) => ({ ...s, acquisitionSource: v }))}><SelectTrigger className="w-full"><SelectValue placeholder="Stock source" /></SelectTrigger><SelectContent>{SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
                <Select value={form.category} onValueChange={(v) => (['consumable', 'medicine', 'instrument', 'implant', 'ppe', 'other'] as const).includes(v as InventoryCategory) && setForm((s) => ({ ...s, category: v as InventoryCategory }))}><SelectTrigger className="w-full"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent>{CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
                <Select value={form.unit} onValueChange={(v) => (['piece', 'box', 'pack', 'bottle', 'tube', 'set', 'kit', 'pair', 'unit'] as const).includes(v as InventoryUnit) && setForm((s) => ({ ...s, unit: v as InventoryUnit }))}><SelectTrigger className="w-full"><SelectValue placeholder="Unit" /></SelectTrigger><SelectContent>{UNIT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
                <Input placeholder="Quantity" type="number" min={0} value={form.quantity} onChange={(e) => setForm((s) => ({ ...s, quantity: e.target.value }))} />
                <Input placeholder="Minimum stock" type="number" min={0} value={form.minStock} onChange={(e) => setForm((s) => ({ ...s, minStock: e.target.value }))} />
                <Input placeholder="Unit cost (AFN)" type="number" min={0} step="0.01" value={form.unitCost} onChange={(e) => setForm((s) => ({ ...s, unitCost: e.target.value }))} />
                <Input placeholder="Supplier" value={form.supplier} onChange={(e) => setForm((s) => ({ ...s, supplier: e.target.value }))} />
                <Input placeholder="Location (shelf/room)" value={form.location} onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))} />
                <Input placeholder="Lot number" value={form.lotNumber} onChange={(e) => setForm((s) => ({ ...s, lotNumber: e.target.value }))} />
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={!form.hasExpiryDate}
                      onChange={(e) => {
                        const noExpiry = e.target.checked;
                        setForm((s) => ({
                          ...s,
                          expiryDate: noExpiry ? '' : s.expiryDate,
                          hasExpiryDate: !noExpiry,
                        }));
                      }}
                    />
                    No expiry date
                  </label>
                  <Input
                    type="date"
                    value={form.expiryDate}
                    disabled={!form.hasExpiryDate}
                    onChange={(e) => setForm((s) => ({ ...s, expiryDate: e.target.value }))}
                  />
                </div>
              </div>
              <textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Notes" rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none" />
              {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={isSaving} onClick={() => void saveItem()}>{isSaving ? 'Saving...' : editingId ? 'Update Item' : 'Save Item'}</Button>
                {editingId ? <Button type="button" variant="outline" onClick={resetForm}>Cancel Edit</Button> : null}
              </div>
            </CardContent></Card>

            <Card className="pt-7"><CardHeader><CardTitle>Inventory Data</CardTitle><CardDescription>All clinic items with stock and date details.</CardDescription></CardHeader><CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <Input placeholder="Search by name, date, supplier..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <Select value={categoryFilter} onValueChange={(v) => (v === 'all' || (['consumable', 'medicine', 'instrument', 'implant', 'ppe', 'other'] as const).includes(v as InventoryCategory)) && setCategoryFilter(v as 'all' | InventoryCategory)}><SelectTrigger className="w-full"><SelectValue placeholder="Category filter" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
                <Select value={stockFilter} onValueChange={(v) => (v === 'all' || v === 'in_stock' || v === 'low' || v === 'out') && setStockFilter(v as StockFilter)}><SelectTrigger className="w-full"><SelectValue placeholder="Stock filter" /></SelectTrigger><SelectContent><SelectItem value="all">All stock states</SelectItem><SelectItem value="in_stock">In Stock</SelectItem><SelectItem value="low">Low Stock</SelectItem><SelectItem value="out">Out of Stock</SelectItem></SelectContent></Select>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[1200px] text-sm">
                  <thead className="bg-muted/40 text-left"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Min</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Supplier</th><th className="px-3 py-2">Unit Cost</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Expiry</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Actions</th></tr></thead>
                  <tbody>
                    {isLoading ? <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={14}>Loading inventory...</td></tr> : filteredItems.length === 0 ? <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={14}>No inventory records found.</td></tr> : filteredItems.map((item) => {
                      const stockState = getStockState(item);
                      return (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2">{item.entryDate}</td>
                          <td className="px-3 py-2"><div className="font-medium">{item.itemName}</div>{item.notes ? <div className="text-xs text-muted-foreground">{item.notes}</div> : null}</td>
                          <td className="px-3 py-2">{item.acquisitionSource === 'purchase' ? <Badge className="bg-blue-600 text-white">Purchase</Badge> : <Badge variant="outline">Previous Stock</Badge>}</td>
                          <td className="px-3 py-2 capitalize">{item.category.replace('_', ' ')}</td>
                          <td className="px-3 py-2">{item.quantity}</td>
                          <td className="px-3 py-2 capitalize">{item.unit}</td>
                          <td className="px-3 py-2">{item.minStock}</td>
                          <td className="px-3 py-2">{stockState === 'in_stock' ? <Badge className="bg-emerald-600 text-white">In Stock</Badge> : stockState === 'low' ? <Badge className="bg-amber-500 text-white">Low</Badge> : <Badge className="bg-rose-600 text-white">Out</Badge>}</td>
                          <td className="px-3 py-2">{item.supplier || '-'}</td>
                          <td className="px-3 py-2">{formatMoney(item.unitCost)}</td>
                          <td className="px-3 py-2">{formatMoney(item.totalCost)}</td>
                          <td className="px-3 py-2">{item.expiryDate || 'No expiry'}{isExpiringSoon(item.expiryDate) ? <div className="text-xs text-orange-600">Expiring soon</div> : null}</td>
                          <td className="px-3 py-2">{item.location || '-'}</td>
                          <td className="px-3 py-2"><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => editItem(item)}>Edit</Button><Button type="button" size="sm" variant="destructive" onClick={() => void deleteItem(item.id)}>Delete</Button></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          </div>
        </div>
      </div>
    </>
  );
}
