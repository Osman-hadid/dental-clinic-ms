'use client';

import { JSX } from 'react';
import { Input } from '@/components/ui/input';
import { EntityModuleConfig } from '@/types/EntityModuleConfig';
import { RegisterOptions, useFormContext } from 'react-hook-form';

type Props = {
  name: string;
  disabled?: boolean;
  type?: string;
  validation?: RegisterOptions;
  error?: boolean;
  config: EntityModuleConfig;
};

export const InputField = ({
  disabled,
  error,
  name,
  type = 'text',
  validation,
}: Props): JSX.Element => {
  const { register } = useFormContext();
  return (
    <Input
      {...register(name, { ...validation, disabled })}
      id={name}
      type={type}
      autoComplete="off"
      className={` ${error ? 'border-red-500' : 'border-gray-300'}`}
    />
  );
};
