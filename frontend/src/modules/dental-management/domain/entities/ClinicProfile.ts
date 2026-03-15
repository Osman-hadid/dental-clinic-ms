export type ClinicProfile = {
  id: number;
  name: string;
  ownerName: string;
  logoPath?: string | null;
  address?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  website?: string | null;
  licenseNumber?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
