import { type PaginationMeta } from '@/types/ApiResponse';
import { create } from 'zustand';
import { type Staff } from '../../domain/entities/Staff';

type StaffState = {
  staff: Staff[];
  pagination: PaginationMeta | null;
  selectedStaff: Staff | null;
  setStaff: (staff: Staff[], pagination: PaginationMeta) => void;
  setSelectedStaff: (staff: Staff | null) => void;
  clearStaff: () => void;
};

export const useStaffStore = create<StaffState>((set) => ({
  clearStaff: () => {
    set({ pagination: null, selectedStaff: null, staff: [] });
  },
  pagination: null,
  staff: [],
  selectedStaff: null,
  setStaff: (staff, pagination) => {
    set({ pagination, staff });
  },
  setSelectedStaff: (selectedStaff) => {
    set({ selectedStaff });
  },
}));
