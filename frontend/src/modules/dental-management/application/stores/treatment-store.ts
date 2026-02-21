import { type PaginationMeta } from '@/types/ApiResponse';
import { create } from 'zustand';
import { type Treatment } from '../../domain/entities/Treatment';

type TreatmentState = {
  treatments: Treatment[];
  pagination: PaginationMeta | null;
  selectedTreatment: Treatment | null;
  setTreatments: (treatments: Treatment[], pagination: PaginationMeta) => void;
  setSelectedTreatment: (treatment: Treatment | null) => void;
  clearTreatments: () => void;
};

export const useTreatmentStore = create<TreatmentState>((set) => ({
  clearTreatments: () => {
    set({ pagination: null, selectedTreatment: null, treatments: [] });
  },
  pagination: null,
  treatments: [],
  selectedTreatment: null,
  setTreatments: (treatments, pagination) => {
    set({ pagination, treatments });
  },
  setSelectedTreatment: (selectedTreatment) => {
    set({ selectedTreatment });
  },
}));
