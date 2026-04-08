<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RolesSeeder extends Seeder
{
    private const MODULES = [
        'user-management',
        'dental-management',
    ];

    public function run(): void
    {
        DB::transaction(function (): void {
            $roles = [
                ['name' => 'super-admin', 'display_name_en' => 'Super Administrator'],
                ['name' => 'admin', 'display_name_en' => 'System Administrator'],
            ];

            foreach (self::MODULES as $module) {
                $pretty = ucwords(str_replace('-', ' ', $module));

                $roles[] = ['name' => "$module-manager", 'display_name_en' => "$pretty Manager"];
                $roles[] = ['name' => "$module-officer", 'display_name_en' => "$pretty Officer"];
                $roles[] = ['name' => "$module-viewer", 'display_name_en' => "$pretty Viewer"];
            }

            foreach ($roles as &$role) {
                $role['display_name_ps'] = $role['display_name_en'];
                $role['display_name_dr'] = $role['display_name_en'];
                $role['guard_name'] = 'web';
                $role['created_at'] = now();
                $role['updated_at'] = now();
            }
            unset($role);

            DB::table('roles')->upsert(
                $roles,
                ['name', 'guard_name'],
                ['display_name_en', 'display_name_ps', 'display_name_dr', 'updated_at']
            );
        });
    }
}
