'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { type Permission } from '@/modules/user-management/domain/entities/Permission';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { usePermissionList } from '../../hooks';

type AssignPermissionsProps = {
  value?: number[];
  onChange: (value: number[]) => void;
};

export const AssignPermissions = ({
  onChange,
  value: controlledValue = [],
}: AssignPermissionsProps): React.JSX.Element => {
  const [open, setOpen] = React.useState(false);
  const selectedPermissions = controlledValue;

  const { entities: permissions, isFetching: isLoading } = usePermissionList(
    1,
    1000,
    '',
    [],
    ['module'],
    {}
  );

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Permission[]>();

    for (const perm of permissions) {
      const moduleName = perm.module?.name || 'UnCategorized';
      const list = groups.get(moduleName) ?? [];
      list.push(perm);
      groups.set(moduleName, list);
    }

    return Array.from(groups.entries())
      .map(([moduleName, perms]) => ({
        moduleName,
        permissions: perms.toSorted((a, b) => a.displayName.localeCompare(b.displayName)),
      }))
      .sort((a, b) => a.moduleName.localeCompare(b.moduleName));
  }, [permissions]);

  const moduleCheckboxRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    for (const { moduleName, permissions: perms } of groupedPermissions) {
      const input = moduleCheckboxRefs.current.get(moduleName);
      if (!input) continue;

      const ids = perms.map((p) => p.id);
      const selectedCount = ids.filter((id) => selectedPermissions.includes(id)).length;

      input.checked = selectedCount === ids.length;
      input.indeterminate = selectedCount > 0 && selectedCount < ids.length;
    }
  }, [selectedPermissions, groupedPermissions]);

  const handleSelectionChange = (newSelection: number[]): void => {
    const unique = Array.from(new Set(newSelection));
    onChange(unique);
  };

  const toggleModule = (moduleName: string, checked: boolean): void => {
    const moduleIds = permissions
      .filter((p) => (p.module?.name || 'UnCategorized') === moduleName)
      .map((p) => p.id);

    const newSelection = checked
      ? [...selectedPermissions, ...moduleIds.filter((id) => !selectedPermissions.includes(id))]
      : selectedPermissions.filter((id) => !moduleIds.includes(id));

    handleSelectionChange(newSelection);
  };

  const togglePermission = (id: number, checked: boolean): void => {
    const newSelection = checked
      ? [...selectedPermissions, id]
      : selectedPermissions.filter((x) => x !== id);
    handleSelectionChange(newSelection);
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading permissions...</div>;
  }

  if (!permissions.length) {
    return <div className="text-muted-foreground">No permissions found.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(!open)}
            className="px-2"
          >
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Label className="text-sm font-medium cursor-pointer">Assign Permissions</Label>
          </Button>
        </div>
        <Badge variant="secondary">{selectedPermissions.length} selected</Badge>
      </div>

      {open && (
        <Accordion type="multiple" className="w-full">
          {groupedPermissions.map(({ moduleName, permissions: modulePerms }) => {
            const ids = modulePerms.map((p) => p.id);
            const selectedCount = ids.filter((id) => selectedPermissions.includes(id)).length;

            return (
              <AccordionItem key={moduleName} value={moduleName} className="border rounded-lg mb-3">
                <div className="flex items-center gap-3 px-4 py-2">
                  <Checkbox
                    id={`module-${moduleName}`}
                    checked={selectedCount === ids.length}
                    ref={(el) => {
                      if (el) {
                        const input = el.querySelector('input[type="checkbox"]') ?? el;
                        if (input instanceof HTMLInputElement) {
                          moduleCheckboxRefs.current.set(moduleName, input);
                        }
                      }
                    }}
                    onCheckedChange={(checked) => toggleModule(moduleName, !!checked)}
                    onClick={(e) => e.stopPropagation()}
                  />

                  <Label
                    htmlFor={`module-${moduleName}`}
                    className="flex-1 cursor-pointer select-none"
                  >
                    <div className="font-medium">{moduleName}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCount} of {modulePerms.length} selected
                    </div>
                  </Label>

                  <Badge variant="outline">{modulePerms.length}</Badge>
                  <AccordionTrigger className="ml-auto shrink-0" />
                </div>

                <AccordionContent className="px-4 pb-4 pt-2">
                  <div className="space-y-3 pl-9">
                    {modulePerms.map((perm) => (
                      <div key={perm.id} className="flex items-center gap-3">
                        <Checkbox
                          id={`perm-${perm.id}`}
                          checked={selectedPermissions.includes(perm.id)}
                          onCheckedChange={(checked) => togglePermission(perm.id, !!checked)}
                        />
                        <Label
                          htmlFor={`perm-${perm.id}`}
                          className="flex-1 cursor-pointer select-none text-sm font-normal"
                        >
                          {perm.displayName}
                          {perm.displayNameEn && perm.displayNameEn !== perm.displayName && (
                            <span className="text-muted-foreground ml-2">
                              ({perm.displayNameEn})
                            </span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
};
