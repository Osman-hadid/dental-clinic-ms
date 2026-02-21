import { type PaginationMeta } from '@/types/ApiResponse';
import { create } from 'zustand';
import { type Tooth } from '../../domain/entities/Tooth';

type ToothState = {
  teeth: Tooth[];
  pagination: PaginationMeta | null;
  selectedTooth: Tooth | null;
  setTeeth: (teeth: Tooth[], pagination: PaginationMeta) => void;
  setSelectedTooth: (tooth: Tooth | null) => void;
  clearTeeth: () => void;
};

export const useToothStore = create<ToothState>((set) => ({
  clearTeeth: () => {
    set({ pagination: null, selectedTooth: null, teeth: [] });
  },
  pagination: null,
  teeth: [],
  selectedTooth: null,
  setTeeth: (teeth, pagination) => {
    set({ pagination, teeth });
  },
  setSelectedTooth: (selectedTooth) => {
    set({ selectedTooth });
  },
}));
