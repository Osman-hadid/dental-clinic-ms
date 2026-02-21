'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useDynamicOptions } from '@/hooks/useDynamicOptions';
import { cn } from '@/lib/utilities';
import { type EntityModuleConfig, type FilterOption } from '@/types/EntityModuleConfig';
import { Column } from '@tanstack/react-table';
import { Check, PlusCircle } from 'lucide-react';
import { JSX } from 'react/jsx-dev-runtime';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './entity-command';

type EntityTableFacetedFilterProps<TData, TValue> = {
  column?: Column<TData, TValue>;
  config: EntityModuleConfig;
  title?: string;
  options: FilterOption[];
  onFilterChange?: (key: string, values: string[]) => void;
};

export const EntityTableFacetedFilter = <TData, TValue>({
  column,
  config,
  onFilterChange,
  options: propOptions,
  title,
}: Readonly<EntityTableFacetedFilterProps<TData, TValue>>): JSX.Element => {
  const t = useTranslations(config.singleQueryKey);
  const tComponent = useTranslations('component.table');

  const filterMeta = config.filters?.find((f) => f.key === column?.id);

  const { data: dynamicOptions = [], isLoading: isLoadingOptions } = useDynamicOptions(
    filterMeta?.optionsSource
  );

  let finalOptions: FilterOption[];

  if (dynamicOptions.length > 0) {
    finalOptions = dynamicOptions;
  } else if (filterMeta?.options?.length) {
    finalOptions = filterMeta.options;
  } else {
    finalOptions = propOptions ?? [];
  }

  const translateLabel = (label: string): string =>
    label?.startsWith('config.') ? t(label) : label;

  if (isLoadingOptions) {
    return (
      <Button variant="outline" size="sm" disabled className="h-8">
        Loading...
      </Button>
    );
  }

  const facets = column?.getFacetedUniqueValues();
  const selectedValues = new Set<string>((column?.getFilterValue() as string[]) || []);

  const handleFilterChange = (values: string[]): void => {
    column?.setFilterValue(values.length ? values : undefined);
    if (column) {
      onFilterChange?.(column?.id, values);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {selectedValues.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selectedValues.size}
              </Badge>
              <div className="hidden gap-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {tComponent('selected', { count: selectedValues.size })}
                  </Badge>
                ) : (
                  finalOptions
                    .filter((o) => selectedValues.has(String(o.value)))
                    .map((o) => (
                      <Badge
                        key={o.value}
                        variant="secondary"
                        className="rounded-sm px-1 font-normal"
                      >
                        {translateLabel(o.label)}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>{tComponent('noResultsFound')}</CommandEmpty>
            <CommandGroup>
              {finalOptions.map((option) => {
                const valueStr = String(option.value);
                const isSelected = selectedValues.has(valueStr);

                return (
                  <CommandItem
                    key={valueStr}
                    onSelect={() => {
                      if (isSelected) {
                        selectedValues.delete(valueStr);
                      } else {
                        selectedValues.add(valueStr);
                      }
                      handleFilterChange(Array.from(selectedValues));
                    }}
                  >
                    <div
                      className={cn(
                        'mr-2 flex size-4 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input [&_svg]:invisible'
                      )}
                    >
                      <Check className="size-3.5" />
                    </div>
                    <span>{translateLabel(option.label)}</span>

                    {facets?.get(valueStr) !== undefined && (
                      <span className="ml-auto flex size-4 items-center justify-center font-mono text-xs text-muted-foreground">
                        {facets.get(valueStr)}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => handleFilterChange([])}
                    className="justify-center text-center"
                  >
                    {tComponent('clearFilters')}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
