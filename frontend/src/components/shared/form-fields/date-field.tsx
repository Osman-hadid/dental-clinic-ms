'use client';

import { JSX, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { CalendarDays } from 'lucide-react';
import { Controller, RegisterOptions, useFormContext } from 'react-hook-form';

type Props = {
  name: string;
  disabled?: boolean;
  type?: 'date' | 'datetime-local';
  validation?: RegisterOptions;
  error?: boolean;
};

const normalizeDateValue = (value: unknown, type: 'date' | 'datetime-local'): string => {
  if (!value) return '';
  if (value instanceof Date) {
    if (type === 'date') return value.toISOString().slice(0, 10);
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  const raw = String(value);
  if (!raw) return '';

  if (type === 'date') {
    if (raw.includes('T')) return raw.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  }

  if (raw.length >= 16 && raw.includes('T')) return raw.slice(0, 16);

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export const DateField = ({
  disabled,
  error,
  name,
  type = 'date',
  validation,
}: Props): JSX.Element => {
  const { control } = useFormContext();
  const inputReference = useRef<HTMLInputElement | null>(null);

  return (
    <Controller
      name={name}
      control={control}
      rules={validation}
      render={({ field }) => {
        const openPicker = (): void => {
          if (disabled || !inputReference.current) return;

          const dateInput = inputReference.current as HTMLInputElement & {
            showPicker?: () => void;
          };

          dateInput.focus();
          if (typeof dateInput.showPicker === 'function') {
            dateInput.showPicker();
            return;
          }
          dateInput.click();
        };

        return (
          <div className="relative">
            <Input
              id={name}
              name={field.name}
              type={type}
              disabled={disabled}
              value={normalizeDateValue(field.value, type)}
              onBlur={field.onBlur}
              onChange={(event) => {
                field.onChange(event.target.value);
              }}
              ref={(element) => {
                inputReference.current = element;
                field.ref(element);
              }}
              className={`${error ? 'border-red-500' : 'border-gray-300'} pe-10`}
            />
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              aria-label="Open calendar"
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
        );
      }}
    />
  );
};
