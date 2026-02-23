export type Appointment = {
  id: number;
  patientId: string;
  dentistId: string;
  patientName?: string;
  dentistName?: string;
  tag: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  notes: string;
  createdBy: string;
  updatedBy: string;
  deletedBy: string;
  status: string;
  visits: string;
  createdAt: string;
  updatedAt: string;
};
