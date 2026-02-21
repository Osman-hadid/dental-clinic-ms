import { type PaginationMeta } from '@/types/ApiResponse';
import { create } from 'zustand';
import { type Patient } from '../../domain/entities/Patient';

type PatientState = {
  patients: Patient[];
  pagination: PaginationMeta | null;
  selectedPatient: Patient | null;
  setPatients: (patients: Patient[], pagination: PaginationMeta) => void;
  setSelectedPatient: (patient: Patient | null) => void;
  clearPatients: () => void;
};

export const usePatientStore = create<PatientState>((set) => ({
  clearPatients: () => {
    set({ pagination: null, selectedPatient: null, patients: [] });
  },
  pagination: null,
  patients: [],
  selectedPatient: null,
  setPatients: (patients, pagination) => {
    set({ pagination, patients });
  },
  setSelectedPatient: (selectedPatient) => {
    set({ selectedPatient });
  },
}));
