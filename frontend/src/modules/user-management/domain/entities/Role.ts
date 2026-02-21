import { Permission } from './Permission';

export type Role = {
  id: number;
  name: string;
  displayName: string;
  displayNameEn: string;
  displayNamePs: string;
  displayNameDr: string;
  permissions: Permission[];
  guardName: string;
  createdAt: string;
  updatedAt: string;
};
