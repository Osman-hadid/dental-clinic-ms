<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            ModulesSeeder::class,
            PermissionsSeeder::class,
            RolesSeeder::class,
            AssignPermissionsToModuleRolesSeeder::class,
            SuperAdminUserSeeder::class,
            AdminUserSeeder::class,
            ThreeMonthsTestDataSeeder::class,
        ]);
    }
}
