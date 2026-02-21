import { type PaginationMeta } from '@/types/ApiResponse';
import { create } from 'zustand';
import { type Visit } from '../../domain/entities/Visit';

type VisitState = {
  visits: Visit[];
  pagination: PaginationMeta | null;
  selectedVisit: Visit | null;
  setVisits: (visits: Visit[], pagination: PaginationMeta) => void;
  setSelectedVisit: (visit: Visit | null) => void;
  clearVisits: () => void;
};

export const useVisitStore = create<VisitState>((set) => ({
  clearVisits: () => {
    set({ pagination: null, selectedVisit: null, visits: [] });
  },
  pagination: null,
  visits: [],
  selectedVisit: null,
  setVisits: (visits, pagination) => {
    set({ pagination, visits });
  },
  setSelectedVisit: (selectedVisit) => {
    set({ selectedVisit });
  },
}));
