'use client';

import { JSX, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { setServerErrors } from '@/modules/common/utils/set-server-errors';
import { type EntityModuleConfig, type FormField } from '@/types/EntityModuleConfig';
import { FormProvider, useForm } from 'react-hook-form';
import { EntityFormField } from './entity-form-field';

type EntityFormProps = {
  defaultValues: any;
  formConfig: FormField[];
  config: EntityModuleConfig;
  onSubmit: (data: any) => Promise<{ success: boolean }>;
  onSuccess: () => void;
  submitText: string;
  errors?: Record<string, string[]> | null;
};

const normalizeFieldValue = (field: FormField, value: any): any => {
  const fieldType = field.type ?? 'text';

  if (fieldType === 'select') {
    if (value === null || value === undefined || value === '') {
      if (!field.relation && Array.isArray(field.options) && field.options.length > 0) {
        return String(field.options[0].value);
      }
      return '';
    }
    if (typeof value === 'object') {
      if (typeof value.id === 'string' || typeof value.id === 'number') return String(value.id);
      if (typeof value.value === 'string' || typeof value.value === 'number') return String(value.value);
      return '';
    }
    return String(value);
  }

  if (fieldType === 'multiselect') {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      if (typeof item === 'object' && item !== null) {
        if (typeof item.id === 'string' || typeof item.id === 'number') return String(item.id);
        if (typeof item.value === 'string' || typeof item.value === 'number') return String(item.value);
      }
      return String(item);
    });
  }

  if (fieldType === 'checkbox' || fieldType === 'switch') {
    return !!value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return '';
  }

  return value;
};

const buildDefaultValues = (defaultValues: any, formConfig: FormField[]): Record<string, any> => {
  const result: Record<string, any> = {};

  for (const field of formConfig) {
    result[field.name] = normalizeFieldValue(field, defaultValues?.[field.name]);
  }

  return result;
};

export const EntityForm = ({
  config,
  defaultValues,
  errors,
  formConfig,
  onSubmit,
  onSuccess,
  submitText,
}: EntityFormProps): JSX.Element => {
  const tComponent = useTranslations('component');
  const normalizedDefaults = buildDefaultValues(defaultValues, formConfig);
  const methods = useForm({ defaultValues: normalizedDefaults });
  const isSchedulingForm = config.queryKey === 'appointments' || config.queryKey === 'visits';

  const fieldByName = new Map(formConfig.map((field) => [field.name, field]));
  const peopleFieldNames = isSchedulingForm
    ? config.queryKey === 'appointments'
      ? ['tag', 'patientId', 'dentistId', 'status']
      : ['tag', 'appointmentId', 'patientId', 'dentistId']
    : [];
  const timingFieldNames = isSchedulingForm
    ? config.queryKey === 'appointments'
      ? ['appointmentDate', 'startTime', 'endTime']
      : ['visitDate', 'nextVisitDate']
    : [];
  const noteFieldNames = isSchedulingForm
    ? config.queryKey === 'appointments'
      ? ['notes']
      : ['diagnosisNotes']
    : [];
  const usedFieldNames = new Set([...peopleFieldNames, ...timingFieldNames, ...noteFieldNames]);
  const additionalFields = formConfig.filter((field) => !usedFieldNames.has(field.name));

  const {
    formState: { isSubmitting },
    handleSubmit,
    reset,
    setError,
    trigger,
  } = methods;

  useEffect(() => {
    if (errors) setServerErrors(errors, setError);
  }, [errors, setError]);

  useEffect(() => {
    reset(buildDefaultValues(defaultValues, formConfig));
  }, [defaultValues, formConfig, reset]);

  const handleFormSubmit = useCallback(
    async (data: any) => {
      if (!(await trigger())) return;
      try {
        const payload = { ...data };
        if (config.queryKey === 'appointments' && !payload.status) {
          payload.status = 'scheduled';
        }
        const response = await onSubmit(payload);
        if (response.success) {
          onSuccess();
          reset();
        }
      } catch (error) {
        console.error('Form submission error:', error);
      }
    },
    [config.queryKey, onSubmit, onSuccess, reset, trigger]
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className={isSchedulingForm ? 'space-y-4 px-4 pb-4' : 'space-y-4 px-4'}>
        {isSchedulingForm ? (
          <>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-semibold">Quick Entry</p>
              <p className="text-xs text-muted-foreground">
                Fill in the core details below to create the record quickly and cleanly.
              </p>
            </div>

            <div className="rounded-xl border bg-background p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">People</p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {peopleFieldNames.map((name) => {
                  const field = fieldByName.get(name);
                  if (!field) {
                    return null;
                  }
                  return <EntityFormField key={field.name} field={field} config={config} />;
                })}
              </div>
            </div>

            <div className="rounded-xl border bg-background p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date And Time</p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {timingFieldNames.map((name) => {
                  const field = fieldByName.get(name);
                  if (!field) {
                    return null;
                  }
                  return <EntityFormField key={field.name} field={field} config={config} />;
                })}
              </div>
            </div>

            {noteFieldNames.some((name) => fieldByName.has(name)) ? (
              <div className="rounded-xl border bg-background p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                <div className="grid gap-4">
                  {noteFieldNames.map((name) => {
                    const field = fieldByName.get(name);
                    if (!field) {
                      return null;
                    }
                    return <EntityFormField key={field.name} field={field} config={config} />;
                  })}
                </div>
              </div>
            ) : null}

            {additionalFields.length > 0 ? (
              <div className="rounded-xl border bg-background p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {additionalFields.map((field) => (
                    <EntityFormField key={field.name} field={field} config={config} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={isSubmitting} className="min-w-40">
                {isSubmitting ? tComponent('submitting') : submitText}
              </Button>
            </div>
          </>
        ) : (
          <>
            {formConfig.map((field) => (
              <EntityFormField key={field.name} field={field} config={config} />
            ))}

            <Button type="submit" disabled={isSubmitting} className="float-end">
              {isSubmitting ? tComponent('submitting') : submitText}
            </Button>
          </>
        )}
      </form>
    </FormProvider>
  );
};
