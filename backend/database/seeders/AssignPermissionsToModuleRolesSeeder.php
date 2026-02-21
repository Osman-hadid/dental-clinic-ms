<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class AssignPermissionsToModuleRolesSeeder extends Seeder
{
    private const MODULES = [
        'user-management',
        'dental-management',
        'incidents',
        'biographic',
        'structures',
        'attendances',
        'biometric-verifications',
        'settings',
        'payrolls',
        'job-descriptions',
        'request-forms',
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (self::MODULES as $module) {
            $prefix = "$module.";
            $permissions = Permission::where('name', 'like', "$prefix%")->get();

            Role::findByName("$module-manager")->syncPermissions($permissions);

            Role::findByName("$module-officer")->syncPermissions(
                $permissions->filter(fn (Permission $permission): bool => in_array(
                    Str::afterLast($permission->name, '.'),
                    ['view', 'create', 'update']
                ))
            );

            Role::findByName("$module-viewer")->syncPermissions(
                $permissions->filter(fn (Permission $permission): bool => in_array(
                    Str::afterLast($permission->name, '.'),
                    ['view', 'export']
                ))
            );
        }

        Role::findByName('super-admin')->syncPermissions(Permission::all());

        $forbidden = Permission::where('name', 'like', '%.force-delete')
            ->where('name', 'like', 'biographic.%')
            ->orWhere('name', 'like', 'structures.%')
            ->orWhere('name', 'like', 'payrolls.%')
            ->orWhere('name', 'like', 'user-management.%')
            ->pluck('name');

        Role::findByName('admin')->syncPermissions(
            Permission::all()->reject(fn (Permission $permission) => $forbidden->contains($permission->name))
        );
    }
}
