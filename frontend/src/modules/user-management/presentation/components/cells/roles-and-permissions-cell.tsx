'use client';

import React, { JSX } from 'react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Item = {
  id?: string | number;
  name?: string;
  displayName?: string;
};

type Props = {
  roles?: Item[];
  permissions?: Item[];
};

export const RolesAndPermissionsCell = ({
  permissions = [],
  roles = [],
}: Props): JSX.Element | null => {
  if (roles.length === 0 && permissions.length === 0) return null;

  const renderLine = (items: Item[]): JSX.Element | null => {
    if (items.length === 0) return null;

    const [first, ...rest] = items;

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary">{first.displayName ?? first.name ?? 'Item'}</Badge>

        {rest.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Badge className="cursor-pointer" variant="outline">
                +{rest.length}
              </Badge>
            </PopoverTrigger>

            <PopoverContent className="max-w-s max-h-60 overflow-auto space-y-1 z-50">
              {rest.map((item, i) => (
                <Badge key={item.id ?? i} variant="secondary" className="block whitespace-nowrap">
                  {item.displayName ?? item.name ?? `Item ${i + 2}`}
                </Badge>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1">
      {renderLine(roles)}
      {renderLine(permissions)}
    </div>
  );
};
