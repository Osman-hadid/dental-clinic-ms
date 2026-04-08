<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class AssignPermissionsToModuleRolesSeeder extends Seeder
{
    private const MODULES = [
        'user-management' => ['user-management.', 'page.user-management.'],
        'dental-management' => ['dental-management.', 'page.dental-management.', 'page.reports.', 'page.inventory-management'],
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (self::MODULES as $module => $prefixes) {
            $permissions = Permission::query()
                ->where(function ($query) use ($prefixes): void {
                    foreach ($prefixes as $prefix) {
                        $query->orWhere('name', 'like', "$prefix%");
                    }
                })
                ->get();

            $this->syncRolePermissions("$module-manager", $permissions);

            $this->syncRolePermissions("$module-officer", $permissions->filter(
                fn (Permission $permission): bool => $this->isOfficerPermission($permission->name)
            ));

            $this->syncRolePermissions("$module-viewer", $permissions->filter(
                fn (Permission $permission): bool => $this->isViewerPermission($permission->name)
            ));
        }

        $allPermissions = Permission::all();
        $this->syncRolePermissions('super-admin', $allPermissions);

        $forbiddenNames = Permission::query()
            ->where('name', 'like', '%.force-delete')
            ->pluck('name');

        $this->syncRolePermissions(
            'admin',
            $allPermissions->reject(
                fn (Permission $permission): bool => $forbiddenNames->contains($permission->name)
            )
        );
    }

    private function syncRolePermissions(string $roleName, Collection $permissions): void
    {
        $role = Role::query()
            ->where('name', $roleName)
            ->where('guard_name', 'web')
            ->first();

        if (!$role) {
            return;
        }

        $role->syncPermissions($permissions);
    }

    private function isOfficerPermission(string $permissionName): bool
    {
        if (Str::startsWith($permissionName, 'page.')) {
            return true;
        }

        return in_array(
            Str::afterLast($permissionName, '.'),
            ['view', 'create', 'update'],
            true
        );
    }

    private function isViewerPermission(string $permissionName): bool
    {
        if (Str::startsWith($permissionName, 'page.')) {
            return true;
        }

        return Str::endsWith($permissionName, '.view');
    }
}
