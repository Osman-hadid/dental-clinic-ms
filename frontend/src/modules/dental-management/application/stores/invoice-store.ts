import { type PaginationMeta } from '@/types/ApiResponse';
import { create } from 'zustand';
import { type Invoice } from '../../domain/entities/Invoice';

type InvoiceState = {
  invoices: Invoice[];
  pagination: PaginationMeta | null;
  selectedInvoice: Invoice | null;
  setInvoices: (invoices: Invoice[], pagination: PaginationMeta) => void;
  setSelectedInvoice: (invoice: Invoice | null) => void;
  clearInvoices: () => void;
};

export const useInvoiceStore = create<InvoiceState>((set) => ({
  clearInvoices: () => {
    set({ pagination: null, selectedInvoice: null, invoices: [] });
  },
  pagination: null,
  invoices: [],
  selectedInvoice: null,
  setInvoices: (invoices, pagination) => {
    set({ pagination, invoices });
  },
  setSelectedInvoice: (selectedInvoice) => {
    set({ selectedInvoice });
  },
}));
