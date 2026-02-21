import { type PaginationMeta } from '@/types/ApiResponse';
import { create } from 'zustand';
import { type Appointment } from '../../domain/entities/Appointment';

type AppointmentState = {
  appointments: Appointment[];
  pagination: PaginationMeta | null;
  selectedAppointment: Appointment | null;
  setAppointments: (appointments: Appointment[], pagination: PaginationMeta) => void;
  setSelectedAppointment: (appointment: Appointment | null) => void;
  clearAppointments: () => void;
};

export const useAppointmentStore = create<AppointmentState>((set) => ({
  clearAppointments: () => {
    set({ pagination: null, selectedAppointment: null, appointments: [] });
  },
  pagination: null,
  appointments: [],
  selectedAppointment: null,
  setAppointments: (appointments, pagination) => {
    set({ pagination, appointments });
  },
  setSelectedAppointment: (selectedAppointment) => {
    set({ selectedAppointment });
  },
}));
