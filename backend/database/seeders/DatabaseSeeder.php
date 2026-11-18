<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $seeders = [
            ModulesSeeder::class,
            PermissionsSeeder::class,
            RolesSeeder::class,
            AssignPermissionsToModuleRolesSeeder::class,
            SuperAdminUserSeeder::class,
            AdminUserSeeder::class,
        ];

        if (filter_var(env('SOURIRE_SEED_DEMO_DATA', false), FILTER_VALIDATE_BOOL)) {
            $seeders[] = ThreeMonthsTestDataSeeder::class;
        }

        $this->call($seeders);
    }
}
