import { type PaginationMeta } from '@/types/ApiResponse';
import { create } from 'zustand';
import { type Module } from '../../domain/entities/Module';

type ModuleState = {
  modules: Module[];
  pagination: PaginationMeta | null;
  selectedModule: Module | null;
  setModules: (modules: Module[], pagination: PaginationMeta) => void;
  setSelectedModule: (module: Module | null) => void;
  clearModules: () => void;
};

export const useModuleStore = create<ModuleState>((set) => ({
  clearModules: () => {
    set({ modules: [], pagination: null, selectedModule: null });
  },
  modules: [],
  pagination: null,
  selectedModule: null,
  setModules: (modules, pagination) => {
    set({ modules, pagination });
  },
  setSelectedModule: (selectedModule) => {
    set({ selectedModule });
  },
}));
