'use client';

import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EntityModuleConfig } from '@/types/EntityModuleConfig';
import { Controller } from 'react-hook-form';

type Props = {
  name: string;
  control: any;
  validation?: any;
  options: { label: string; value: string; disabled?: boolean; description?: string }[];
  error?: boolean;
  config: EntityModuleConfig;
};

export const SelectField = ({
  config,
  control,
  error,
  name,
  options,
  validation,
}: Props): JSX.Element => {
  const tGlobal = useTranslations('global');
  const t = useTranslations(config.singleQueryKey);
  const resolveLabel = (label: string): string => (label.startsWith('config.') ? t(label) : label);

  return (
    <Controller
      name={name}
      control={control}
      rules={validation}
      render={({ field }) => {
        const rawValue = field.value;
        const normalizedValue =
          rawValue === null || rawValue === undefined
            ? ''
            : typeof rawValue === 'object'
              ? String(
                  (rawValue as { id?: string | number; value?: string | number }).id
                  ?? (rawValue as { value?: string | number }).value
                  ?? ''
                )
              : String(rawValue);

        return (
        <Select
          onValueChange={field.onChange}
          value={normalizedValue}
          autoComplete="off"
          name={name}
        >
          <SelectTrigger className={`w-full ${error ? 'border-red-500' : ''}`} id={name}>
            <SelectValue placeholder={`-- ${tGlobal('select')} --`} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  title={opt.description}
                >
                  {resolveLabel(opt.label)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        );
      }}
    />
  );
};
