'use client';

import React, { JSX } from 'react';
import { EntityCombobox } from '@/components/shared/entity/entity-combobox';
import { type Module } from '@/modules/settings/domain/entities/Module';
import { moduleConfig } from '@/modules/settings/presentation/config/module-config';
import { useGetModule, useModuleList } from '@/modules/settings/presentation/hooks';

type ModuleFieldProps = {
  value?: string | number;
  onChange: (value: string | number, item?: Module) => void;
  defaultValues?: { moduleId?: string | number };
};

export const ModuleField = ({ defaultValues, onChange, value }: ModuleFieldProps): JSX.Element => {
  const moduleId = defaultValues?.moduleId ?? null;
  const shouldFetchModule = !!moduleId && (!value || String(value) === String(moduleId));
  const { data: moduleData, isFetching } = useGetModule(moduleId || '', {
    enabled: shouldFetchModule,
  });

  return (
    <EntityCombobox
      fetchHook={useModuleList}
      fetchByIdHook={useGetModule}
      label="Module"
      value={value ?? moduleId ?? undefined}
      initialItem={moduleData?.data ?? undefined}
      onChange={onChange}
      valueKey="id"
      config={moduleConfig}
      labelFormatter={(m) => m.name}
      queryKey={moduleConfig.singleQueryKey}
      disabled={isFetching}
    />
  );
};
