export type Invoice = {
  id: number;
  patientId: string;
  visitId: string;
  sourceVisitIds?: number[];
  totalAmount: string;
  netAmount: string;
  invoiceDate: string;
  notes: string;
  createdBy: string;
  updatedBy: string;
  deletedBy: string;
  discount: string;
  status: string;
  paymentType?: string;
  payments: string;
  createdAt: string;
  updatedAt: string;
};
