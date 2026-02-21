import { type PaginationMeta } from '@/types/ApiResponse';
import { create } from 'zustand';
import { type VisitTreatment } from '../../domain/entities/VisitTreatment';

type VisitTreatmentState = {
  visitTreatments: VisitTreatment[];
  pagination: PaginationMeta | null;
  selectedVisitTreatment: VisitTreatment | null;
  setVisitTreatments: (visitTreatments: VisitTreatment[], pagination: PaginationMeta) => void;
  setSelectedVisitTreatment: (visitTreatment: VisitTreatment | null) => void;
  clearVisitTreatments: () => void;
};

export const useVisitTreatmentStore = create<VisitTreatmentState>((set) => ({
  clearVisitTreatments: () => {
    set({ pagination: null, selectedVisitTreatment: null, visitTreatments: [] });
  },
  pagination: null,
  visitTreatments: [],
  selectedVisitTreatment: null,
  setVisitTreatments: (visitTreatments, pagination) => {
    set({ pagination, visitTreatments });
  },
  setSelectedVisitTreatment: (selectedVisitTreatment) => {
    set({ selectedVisitTreatment });
  },
}));
