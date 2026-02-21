import { type Module } from '@/modules/settings/domain/entities/Module';

export type Permission = {
  id: number;
  name: string;
  moduleId: string;
  module: Module;
  displayName: string;
  displayNameEn: string;
  displayNamePs: string;
  displayNameDr: string;
  guardName: string;
  createdAt: string;
  updatedAt: string;
};
