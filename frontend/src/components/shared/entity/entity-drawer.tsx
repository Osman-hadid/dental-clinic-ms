'use client';

import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utilities';
import { type EntityModuleConfig, type FormField } from '@/types/EntityModuleConfig';
import { EntityForm } from './entity-form';

type EntityDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: any;
  config: EntityModuleConfig;
  onSubmit: (data: any, id?: number) => Promise<any>;
  errors?: Record<string, string[]> | null;
};

export const EntityDrawer = ({
  config,
  entity,
  errors,
  onOpenChange,
  onSubmit,
  open,
}: EntityDrawerProps): JSX.Element => {
  const t = useTranslations(config.singleQueryKey);
  const tComponent = useTranslations('component');
  const tGlobal = useTranslations('global');
  const isSchedulingDrawer = config.queryKey === 'appointments' || config.queryKey === 'visits';

  const entityName = t(config.entity);

  const modifiedFormFields: FormField[] = config.formFields.map((field) => {
    if (field.name === 'password' && !entity) {
      return {
        ...field,
        required: true,
        validation: {
          ...field.validation,
          required: tComponent('passwordIsRequired'),
        },
      };
    }
    return field;
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className={cn(
        'max-h-screen overflow-y-auto overflow-x-hidden py-4',
        isSchedulingDrawer ? 'sm:max-w-2xl' : ''
      )}
      >
        <DrawerHeader>
          <DrawerTitle>
            {entity
              ? t(config.editTitle, { entity: entityName })
              : t(config.createTitle, { entity: entityName })}
          </DrawerTitle>
          {isSchedulingDrawer ? (
            <p className="text-xs text-muted-foreground">
              Fast workflow designed for front-desk and clinical staff.
            </p>
          ) : null}
        </DrawerHeader>

        <EntityForm
          defaultValues={entity}
          formConfig={modifiedFormFields}
          config={config}
          onSubmit={(data) => onSubmit(data, entity?.id)}
          onSuccess={() => {
            onOpenChange(false);
          }}
          submitText={entity ? tGlobal('update') : tGlobal('create')}
          errors={errors}
        />
      </DrawerContent>
    </Drawer>
  );
};
