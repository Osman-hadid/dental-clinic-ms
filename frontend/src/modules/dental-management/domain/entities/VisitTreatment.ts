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

export type VisitTreatmentImageModality =
  | 'xray'
  | 'opg'
  | 'cbct'
  | 'intraoral_photo'
  | 'scanner_export'
  | 'other';

export type VisitTreatmentImageSource = 'upload' | 'camera' | 'device_import';

export type VisitTreatmentImage = {
  id?: number;
  visitTreatmentId?: string;
  path?: string;
  url?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type VisitTreatmentCorrectionEntry = {
  id?: number;
  event?: string;
  description?: string;
  correctionReason?: string;
  changedBy?: string;
  createdAt?: string;
  changes?: Array<{
    field?: string;
    label?: string;
    before?: string;
    after?: string;
  }>;
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
  imageModality?: VisitTreatmentImageModality;
  imageSource?: VisitTreatmentImageSource;
  notes?: string;
  prescription?: Prescription;
  materialItems?: Array<{ inventoryItemId: string; quantity: number } | VisitTreatmentMaterial>;
  treatmentImages?: Array<VisitTreatmentImage | File>;
  retainedTreatmentImageIds?: number[];
  correctionReason?: string;
  correctionHistory?: VisitTreatmentCorrectionEntry[];
  createdBy?: string;
  updatedBy?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
};
