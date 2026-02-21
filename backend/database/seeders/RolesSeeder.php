<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RolesSeeder extends Seeder
{
    private const MODULES = [
        'user-management',
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
        DB::transaction(function (): void {
            $roles = [
                [
                    'name' => 'super-admin',
                    'display_name_en' => 'Super Administrator',
                    'display_name_ps' => 'سوپر مدیر',
                    'display_name_dr' => 'مدیر کل',
                ],
                [
                    'name' => 'admin',
                    'display_name_en' => 'System Administrator',
                    'display_name_ps' => 'مدیر سیستم',
                    'display_name_dr' => 'مدیر سیستم',
                ],
            ];

            foreach (self::MODULES as $module) {
                $pretty = ucwords(str_replace('-', ' ', $module));

                $roles[] = [
                    'name' => "$module-manager",
                    'display_name_en' => "$pretty Manager",
                    'display_name_ps' => $this->ps("$module مدیر"),
                    'display_name_dr' => $this->dr("$module مدیر"),
                ];
                $roles[] = [
                    'name' => "$module-officer",
                    'display_name_en' => "$pretty Officer",
                    'display_name_ps' => $this->ps("$module افسر"),
                    'display_name_dr' => $this->dr("$module مسئول"),
                ];
                $roles[] = [
                    'name' => "$module-viewer",
                    'display_name_en' => "$pretty Viewer",
                    'display_name_ps' => $this->ps("$module لیدونکی"),
                    'display_name_dr' => $this->dr("$module بیننده"),
                ];
            }

            foreach ($roles as &$role) {
                $role['guard_name'] = 'web';
                $role['created_at'] = $role['updated_at'] = now();
            }

            DB::table('roles')->upsert(
                $roles,
                ['name', 'guard_name'],
                [
                    'display_name_en',
                    'display_name_ps',
                    'display_name_dr',
                    'updated_at',
                ]
            );
        });
    }

    private function ps(string $text): string
    {
        return match (true) {
            str_contains($text, 'user-management') => 'د کاروونکو مدیریت '.substr($text, 16),
            str_contains($text, 'incidents') => 'پېښې '.substr($text, 10),
            str_contains($text, 'biographic') => 'بیوگرافي '.substr($text, 11),
            str_contains($text, 'structures') => 'تشکیلات '.substr($text, 11),
            str_contains($text, 'attendances') => 'حاضري '.substr($text, 12),
            str_contains($text, 'biometric-verifications') => 'بایومتریک تصدیق '.substr($text, 24),
            str_contains($text, 'settings') => 'تنظیمات '.substr($text, 9),
            str_contains($text, 'payrolls') => 'معاشات '.substr($text, 9),
            str_contains($text, 'job-descriptions') => 'وظایف دندې '.substr($text, 17),
            str_contains($text, 'request-forms') => 'فورمې غوښتنې '.substr($text, 14),
            default => $text,
        };
    }

    private function dr(string $text): string
    {
        return match (true) {
            str_contains($text, 'user-management') => 'مدیریت کاربران '.substr($text, 16),
            str_contains($text, 'incidents') => 'حوادث '.substr($text, 10),
            str_contains($text, 'biographic') => 'بیوگرافی '.substr($text, 11),
            str_contains($text, 'structures') => 'تشکیلات '.substr($text, 11),
            str_contains($text, 'attendances') => 'حضور و غیاب '.substr($text, 12),
            str_contains($text, 'biometric-verifications') => 'تأیید بایومتریک '.substr($text, 24),
            str_contains($text, 'settings') => 'تنظیمات '.substr($text, 9),
            str_contains($text, 'payrolls') => 'حقوق و معاشات '.substr($text, 9),
            str_contains($text, 'job-descriptions') => 'وظایف شغلی '.substr($text, 17),
            str_contains($text, 'request-forms') => 'فورم‌های درخواست '.substr($text, 14),
            default => $text,
        };
    }
}
