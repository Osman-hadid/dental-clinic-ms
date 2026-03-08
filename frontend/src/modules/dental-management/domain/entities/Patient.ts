import { type PatientQuestionAnswer } from './PatientQuestion';

export type Patient = {
  id: number;
  patientCode: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  contactNumber: string;
  email: string;
  address: string;
  bloodGroup: string;
  emergencyContact: string;
  remarks: string;
  createdBy: string;
  updatedBy: string;
  deletedBy: string;
  enabled: string;
  status: string;
  appointments: string;
  visits: string;
  invoices: string;
  questionnaireResponses?: PatientQuestionAnswer[];
  createdAt: string;
  updatedAt: string;
};
