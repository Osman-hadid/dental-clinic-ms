import { type PaginationMeta } from '@/types/ApiResponse';
import { create } from 'zustand';
import { type Permission } from '../../domain/entities/Permission';

type PermissionState = {
  permissions: Permission[];
  pagination: PaginationMeta | null;
  selectedPermission: Permission | null;
  setPermissions: (permissions: Permission[], pagination: PaginationMeta) => void;
  setSelectedPermission: (permission: Permission | null) => void;
  clearPermissions: () => void;
};

export const usePermissionStore = create<PermissionState>((set) => ({
  clearPermissions: () => {
    set({ pagination: null, permissions: [], selectedPermission: null });
  },
  pagination: null,
  permissions: [],
  selectedPermission: null,
  setPermissions: (permissions, pagination) => {
    set({ pagination, permissions });
  },
  setSelectedPermission: (selectedPermission) => {
    set({ selectedPermission });
  },
}));
