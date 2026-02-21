<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ModulesSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            [
                'name_en' => 'User Management',
                'name_ps' => 'د کاروونکو مدیریت',
                'name_dr' => 'مدیریت کاربران',
                'url' => '/user-management',
                'description' => 'Manage users, roles, and permissions.',
                'sort_order' => 1,
            ],
            [
                'name_en' => 'Dental Management',
                'name_ps' => 'د غاښونو مدیریت',
                'name_dr' => 'مدیریت دندان',
                'url' => '/dental-management',
                'description' => 'Manage patients, appointments, visits, treatments, and billing.',
                'sort_order' => 2,
            ],
            [
                'name_en' => 'Incidents',
                'name_ps' => 'پېښې',
                'name_dr' => 'حوادث',
                'url' => '/incidents',
                'description' => 'Manage incident records.',
                'sort_order' => 3,
            ],
            [
                'name_en' => 'Biographic',
                'name_ps' => 'بیوگرافي',
                'name_dr' => 'بیوگرافی',
                'url' => '/biographic',
                'description' => 'Biographic information of employees.',
                'sort_order' => 4,
            ],
            [
                'name_en' => 'Structures',
                'name_ps' => 'تشکیلات',
                'name_dr' => 'تشکیلات',
                'url' => '/structures',
                'description' => 'Organizational structure and formation management.',
                'sort_order' => 5,
            ],
            [
                'name_en' => 'Attendances',
                'name_ps' => 'حاضري',
                'name_dr' => 'حضور و غیاب',
                'url' => '/attendances',
                'description' => 'Daily attendance and time tracking.',
                'sort_order' => 6,
            ],
            [
                'name_en' => 'Biometric Verifications',
                'name_ps' => 'بایومتریک تصدیق',
                'name_dr' => 'تأیید بایومتریک',
                'url' => '/biometric-verifications',
                'description' => 'Fingerprint and facial recognition verification.',
                'sort_order' => 7,
            ],
            [
                'name_en' => 'Settings',
                'name_ps' => 'تنظیمات',
                'name_dr' => 'تنظیمات',
                'url' => '/settings',
                'description' => 'System settings and configurations.',
                'sort_order' => 8,
            ],
            [
                'name_en' => 'Payrolls',
                'name_ps' => 'معاشات',
                'name_dr' => 'حقوق و معاشات',
                'url' => '/payrolls',
                'description' => 'Salary processing and payroll management.',
                'sort_order' => 9,
            ],
            [
                'name_en' => 'Job Descriptions',
                'name_ps' => 'وظایف دندې',
                'name_dr' => 'وظایف شغلی',
                'url' => '/job-descriptions',
                'description' => 'Official job duties and responsibilities.',
                'sort_order' => 10,
            ],
            [
                'name_en' => 'Request Forms',
                'name_ps' => 'فورمې غوښتنې',
                'name_dr' => 'فورم‌های درخواست',
                'url' => '/request-forms',
                'description' => 'Digital forms for leave, promotion, and other requests.',
                'sort_order' => 11,
            ],
        ];

        foreach ($modules as $module) {
            DB::table('modules')->updateOrInsert(
                ['url' => $module['url']],
                [
                    ...$module,
                    'updated_at' => now(),
                ]
            );
        }
    }
}
