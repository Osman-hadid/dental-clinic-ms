export type Payment = {
  id: number;
  invoiceId: string;
  paymentDate: string;
  amount: string;
  amountInput?: string;
  currency?: 'USD' | 'AFN' | string;
  exchangeRate?: string | number;
  method: string;
  notes?: string;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
};
