'use client';

import React from 'react';
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
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useRoleList } from '../../hooks';

type AssignRolesProps = {
  value: number[];
  onChange: (ids: number[]) => void;
};

export const AssignRoles = ({ onChange, value = [] }: AssignRolesProps): React.JSX.Element => {
  const [open, setOpen] = React.useState(false);
  const selectedRoles = value;

  const { entities: roles, isFetching } = useRoleList(1, 100, '', [], ['permissions']);

  const getPermissionsByModule = (
    permissions: any[] = []
  ): { module: string; permissions: any[] }[] => {
    const groups: Record<string, any[]> = {};

    for (const p of permissions) {
      const moduleName = p.module?.name || 'UnCategorized';
      if (!groups[moduleName]) groups[moduleName] = [];
      groups[moduleName].push(p);
    }

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([module, perms]) => ({
        module,
        permissions: perms.toSorted((a, b) => a.displayName.localeCompare(b.displayName)),
      }));
  };

  const toggleRole = (roleId: number, checked: boolean): void => {
    const newSelection = checked
      ? [...selectedRoles, roleId]
      : selectedRoles.filter((id) => id !== roleId);

    onChange(Array.from(new Set(newSelection)));
  };

  if (isFetching) return <div className="text-muted-foreground">Loading roles...</div>;
  if (!roles.length) return <div className="text-muted-foreground">No roles found.</div>;

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
            <Label className="text-sm font-medium cursor-pointer">Assign Roles</Label>
          </Button>
        </div>
        <Badge variant="secondary">{selectedRoles.length} selected</Badge>
      </div>

      {open && (
        <Accordion type="multiple" className="w-full">
          {roles.map((role) => {
            const isSelected = selectedRoles.includes(role.id);
            const permissionsByModule = getPermissionsByModule(role.permissions);

            return (
              <AccordionItem
                key={role.id}
                value={`role-${role.id}`}
                className="border rounded-lg mb-3 overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition">
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => toggleRole(role.id, !!checked)}
                  />

                  <div className="flex-1">
                    <Label htmlFor={`role-${role.id}`} className="cursor-pointer font-medium">
                      {role.displayName || role.name}
                    </Label>
                    <div className="text-sm text-muted-foreground">
                      {role.permissions?.length || 0} permission
                      {(role.permissions?.length || 0) === 1 ? '' : 's'}
                    </div>
                  </div>

                  <AccordionTrigger className="text-muted-foreground" />
                </div>

                <AccordionContent className="bg-muted/30 border-t">
                  <div className="px-6 py-4 space-y-5">
                    {permissionsByModule.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        No permissions assigned
                      </p>
                    ) : (
                      permissionsByModule.map(({ module, permissions }) => (
                        <div key={module}>
                          <h4 className="font-medium text-sm mb-2.5">{module}</h4>
                          <div className="space-y-2">
                            {permissions.map((perm: any) => (
                              <div key={perm.id} className="flex items-center gap-3">
                                <Checkbox checked disabled />
                                <span className="text-sm text-muted-foreground">
                                  {perm.displayName}
                                  {perm.displayNameEn &&
                                    perm.displayNameEn !== perm.displayName && (
                                      <span className="text-xs ml-1"> ({perm.displayNameEn})</span>
                                    )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
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
