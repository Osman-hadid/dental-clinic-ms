export type PrescriptionItem = {
  id?: number;
  prescriptionId?: string;
  name: string;
  unit?: string;
  amount: string;
  frequency: string;
  foodTiming: 'before_food' | 'after_food' | 'with_food' | 'anytime';
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Prescription = {
  id?: number;
  visitId?: string;
  visitTreatmentId?: string;
  patientId?: string;
  dentistId?: string;
  content?: string;
  name?: string;
  unit?: string;
  amount?: string;
  frequency?: string;
  foodTiming?: 'before_food' | 'after_food' | 'with_food' | 'anytime';
  items?: PrescriptionItem[];
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type VisitTreatmentMaterial = {
  id?: number;
  visitTreatmentId?: string;
  inventoryItemId?: string;
  itemName?: string;
  unit?: string;
  quantityUsed?: number;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type VisitTreatment = {
  id: number;
  visitId: string;
  treatmentId: string;
  toothId?: string;
  toothNumber?: string;
  dentistId?: string;
  price: string;
  material?: string;
  notes?: string;
  prescription?: Prescription;
  materialItems?: Array<{ inventoryItemId: string; quantity: number } | VisitTreatmentMaterial>;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
};
