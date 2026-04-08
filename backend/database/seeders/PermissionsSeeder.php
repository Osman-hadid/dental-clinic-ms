<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PermissionsSeeder extends Seeder
{
    private const ACTIONS = ['view', 'create', 'update', 'delete', 'restore', 'force-delete', 'bulk-delete'];

    private const MODULES = [
        '/user-management' => 'User Management',
        '/dental-management' => 'Dental Management',
    ];

    private const RESOURCES = [
        '/user-management' => ['users', 'roles', 'permissions'],
        '/dental-management' => [
            'patients',
            'patient-questions',
            'clinic-profile',
            'staff',
            'appointments',
            'visits',
            'teeth',
            'treatments',
            'visit-treatments',
            'invoices',
            'payments',
            'debts',
            'backups',
            'shareholders',
            'shareholder-transactions',
        ],
    ];

    private const PAGE_PERMISSIONS = [
        'page.dashboard',
        'page.inventory-management',
        'page.user-management.users',
        'page.user-management.roles',
        'page.user-management.permissions',
        'page.dental-management.patients',
        'page.dental-management.patient-questions',
        'page.dental-management.appointments',
        'page.dental-management.visits',
        'page.dental-management.visit-treatments',
        'page.dental-management.treatments',
        'page.dental-management.implants',
        'page.dental-management.implants-in-process',
        'page.dental-management.invoices',
        'page.dental-management.payments',
        'page.dental-management.staff',
        'page.dental-management.shareholders',
        'page.dental-management.backups',
        'page.dental-management.clinic-profile',
        'page.reports.overview',
        'page.reports.debts',
        'page.reports.financial-control',
        'page.reports.daily-expenses',
        'page.reports.clinical-expenses',
        'page.reports.safe',
        'page.reports.salaries',
        'page.reports.shareholders',
        'page.reports.audit',
    ];

    public function run(): void
    {
        DB::transaction(function (): void {
            $permissions = [];
            $moduleIds = DB::table('modules')
                ->whereIn('url', array_keys(self::MODULES))
                ->pluck('id', 'url')
                ->all();

            foreach (self::MODULES as $url => $moduleName) {
                $moduleId = $moduleIds[$url] ?? null;
                if (!$moduleId) {
                    continue;
                }

                $slug = Str::after($url, '/');

                foreach (self::ACTIONS as $action) {
                    $displayName = $this->displayName($moduleName, $action);
                    $permissions[] = $this->permissionRow(
                        name: "$slug.$action",
                        displayName: $displayName,
                        moduleId: $moduleId
                    );
                }

                foreach (self::RESOURCES[$url] ?? [] as $resource) {
                    $resourceName = $this->humanize($resource);

                    foreach (self::ACTIONS as $action) {
                        $displayName = $this->displayName($resourceName, $action);
                        $permissions[] = $this->permissionRow(
                            name: "$slug.$resource.$action",
                            displayName: $displayName,
                            moduleId: $moduleId
                        );
                    }
                }
            }

            foreach (self::PAGE_PERMISSIONS as $permissionName) {
                $displayName = $this->humanize(str_replace('.', ' ', Str::after($permissionName, 'page.')));
                $permissions[] = $this->permissionRow(
                    name: $permissionName,
                    displayName: $displayName,
                    moduleId: null
                );
            }

            DB::table('permissions')->upsert(
                $permissions,
                ['name', 'guard_name'],
                ['display_name_en', 'display_name_ps', 'display_name_dr', 'module_id', 'updated_at']
            );
        });
    }

    private function permissionRow(string $name, string $displayName, ?int $moduleId): array
    {
        return [
            'name' => $name,
            'display_name_en' => $displayName,
            'display_name_ps' => $displayName,
            'display_name_dr' => $displayName,
            'module_id' => $moduleId,
            'guard_name' => 'web',
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    private function displayName(string $base, string $action): string
    {
        $labels = [
            'view' => 'View',
            'create' => 'Create',
            'update' => 'Update',
            'delete' => 'Delete',
            'restore' => 'Restore',
            'force-delete' => 'Force Delete',
            'bulk-delete' => 'Bulk Delete',
        ];

        return ($labels[$action] ?? ucfirst(str_replace('-', ' ', $action)))." $base";
    }

    private function humanize(string $text): string
    {
        return ucfirst(str_replace(['-', '_'], ' ', $text));
    }
}
