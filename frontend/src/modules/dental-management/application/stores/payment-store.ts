import { type PaginationMeta } from '@/types/ApiResponse';
import { create } from 'zustand';
import { type Payment } from '../../domain/entities/Payment';

type PaymentState = {
  payments: Payment[];
  pagination: PaginationMeta | null;
  selectedPayment: Payment | null;
  setPayments: (payments: Payment[], pagination: PaginationMeta) => void;
  setSelectedPayment: (payment: Payment | null) => void;
  clearPayments: () => void;
};

export const usePaymentStore = create<PaymentState>((set) => ({
  clearPayments: () => {
    set({ pagination: null, selectedPayment: null, payments: [] });
  },
  pagination: null,
  payments: [],
  selectedPayment: null,
  setPayments: (payments, pagination) => {
    set({ pagination, payments });
  },
  setSelectedPayment: (selectedPayment) => {
    set({ selectedPayment });
  },
}));
