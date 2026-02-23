import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { useDynamicOptions } from '@/hooks/useDynamicOptions';
import { getErrorMessage } from '@/modules/common/utils/get-error-message';
import { type EntityModuleConfig, type FormField } from '@/types/EntityModuleConfig';
import { useFormContext } from 'react-hook-form';
import { CustomFieldRenderer } from '../custom-field-renderer';
import { DateField } from '../form-fields/date-field';
import { FileField } from '../form-fields/file-field';
import { InputField } from '../form-fields/input-field';
import { PhoneField } from '../form-fields/phone-field';
import { SelectField } from '../form-fields/select-field';
import { SwitchField } from '../form-fields/switch-field';
import { TextAreaField } from '../form-fields/text-area-field';

export const EntityFormField = ({
  config,
  field,
}: {
  config: EntityModuleConfig;
  field: FormField;
}): JSX.Element => {
  const t = useTranslations(config.singleQueryKey);
  const tGlobal = useTranslations('global');
  const { control, formState } = useFormContext();
  const formErrors = formState.errors;

  const errorMessage = getErrorMessage(formErrors[field.name], t);
  const fieldType = field.type ?? 'text';
  const isRelationField = fieldType === 'select' && !!field.relation;
  const { data: dynamicOptions = [], isLoading: isLoadingDynamicOptions } = useDynamicOptions(
    isRelationField ? { relation: field.relation as string, type: 'relation' } : undefined
  );

  if (field.type === 'custom' && field.render) {
    return <CustomFieldRenderer field={field} control={control} errorMessage={errorMessage} />;
  }

  const fieldProps = {
    config,
    control,
    disabled: field.disabled || isLoadingDynamicOptions || false,
    error: !!formErrors[field.name],
    label: field.label,
    name: field.name,
    options: isRelationField
      ? dynamicOptions.map((option) => ({ ...option, value: String(option.value) }))
      : field.options || [],
    type: fieldType,
    validation: field.validation,
  };

  return (
    <div className="space-y-2">
      {fieldType !== 'switch' && fieldType !== 'checkbox' && (
        <label htmlFor={field.name} className="text-sm font-medium">
          {t(field.label)}
          {!field.required && (
            <span className="text-gray-500 italic ms-1">({tGlobal('optional')})</span>
          )}
        </label>
      )}

      {fieldType === 'select' && <SelectField {...fieldProps} />}
      {fieldType === 'textarea' && <TextAreaField {...fieldProps} />}
      {fieldType === 'phone' && <PhoneField {...fieldProps} />}
      {(fieldType === 'date' || fieldType === 'datetime-local') && (
        <DateField {...fieldProps} type={fieldType} />
      )}
      {fieldType === 'file' && <FileField {...fieldProps} />}
      {(fieldType === 'switch' || fieldType === 'checkbox') && <SwitchField {...fieldProps} />}
      {(fieldType === 'text' ||
        fieldType === 'number' ||
        fieldType === 'time' ||
        fieldType === 'email' ||
        fieldType === 'password') && <InputField {...fieldProps} />}

      {errorMessage && <p className="text-red-500 text-sm">{errorMessage}</p>}
    </div>
  );
};
