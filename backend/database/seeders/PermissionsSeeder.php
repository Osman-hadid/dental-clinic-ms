<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PermissionsSeeder extends Seeder
{
    private const ACTIONS = ['view', 'create', 'update', 'delete', 'restore', 'force-delete', 'bulk-delete', 'export', 'import'];

    private const MODULES = [
        '/user-management' => ['en' => 'User Management',          'ps' => 'د کاروونکو مدیریت',        'dr' => 'مدیریت کاربران'],
        '/incidents' => ['en' => 'Incidents',                'ps' => 'پېښې',                   'dr' => 'حوادث'],
        '/biographic' => ['en' => 'Biographic',               'ps' => 'بیوگرافي',               'dr' => 'بیوگرافی'],
        '/structures' => ['en' => 'Structures',               'ps' => 'تشکیلات',                'dr' => 'تشکیلات'],
        '/attendances' => ['en' => 'Attendances',              'ps' => 'حاضري',                  'dr' => 'حضور و غیاب'],
        '/biometric-verifications' => ['en' => 'Biometric Verifications',  'ps' => 'بایومتریک تصدیق',       'dr' => 'تأیید بایومتریک'],
        '/settings' => ['en' => 'Settings',                 'ps' => 'تنظیمات',                'dr' => 'تنظیمات'],
        '/payrolls' => ['en' => 'Payrolls',                 'ps' => 'معاشات',                 'dr' => 'حقوق و معاشات'],
        '/job-descriptions' => ['en' => 'Job Descriptions',        'ps' => 'وظایف دندې',             'dr' => 'وظایف شغلی'],
        '/request-forms' => ['en' => 'Request Forms',            'ps' => 'فورمې غوښتنې',           'dr' => 'فورم‌های درخواست'],
    ];

    private const RESOURCE_NAMES = [
        'users' => ['en' => 'Users', 'ps' => 'کاروونکي', 'dr' => 'کاربران'],
        'roles' => ['en' => 'Roles', 'ps' => 'رولونه', 'dr' => 'نقش‌ها'],
        'permissions' => ['en' => 'Permissions', 'ps' => 'اجازې', 'dr' => 'اجازه‌ها'],
        'employee-activities' => ['en' => 'Employee Activities', 'ps' => 'د کارکوونکو فعالیتونه', 'dr' => 'فعالیت‌های کارمندان'],
        'online-employees' => ['en' => 'Online Employees', 'ps' => 'آنلاین کارکوونکي', 'dr' => 'کارمندان آنلاین'],
        'update-user-password' => ['en' => 'Update User Password', 'ps' => 'د کاروونکي پټنوم بدلول', 'dr' => 'تغییر رمز کاربر'],
        'incidents' => ['en' => 'Incidents', 'ps' => 'پېښې', 'dr' => 'حوادث'],
        'incident-reports' => ['en' => 'Incident Reports', 'ps' => 'د پېښو راپور', 'dr' => 'گزارش حوادث'],
        'employee-details' => ['en' => 'Employee Details', 'ps' => 'د کارکوونکي تفصیلات', 'dr' => 'جزئیات کارمند'],
        'inactive-employees' => ['en' => 'Inactive Employees', 'ps' => 'غیرفعال کارکوونکي', 'dr' => 'کارمندان غیرفعال'],
        'suspended-employees' => ['en' => 'Suspended Employees', 'ps' => 'معلق کارکوونکي', 'dr' => 'کارمندان معلق'],
        'add-vacant-positions' => ['en' => 'Add Vacant Positions', 'ps' => 'خالي بستونه اضافه کول', 'dr' => 'اضافه کردن بست‌های خالی'],
        'check-position-statuses' => ['en' => 'Check Position Statuses', 'ps' => 'د بست حالت کتل', 'dr' => 'بررسی وضعیت بست'],
        'unknown-persons' => ['en' => 'Unknown Persons', 'ps' => 'نامعلوم کسان', 'dr' => 'اشخاص نامعلوم'],
        'data-entry-reports' => ['en' => 'Data Entry Reports', 'ps' => 'د معلوماتو داخلولو راپور', 'dr' => 'گزارش ورود داده'],
        'assignments-lists' => ['en' => 'Assignments Lists', 'ps' => 'د ګمارنو لست', 'dr' => 'لیست انتصابات'],
        'assignment-filters' => ['en' => 'Assignments Filters', 'ps' => 'د ګمارنو فلټر', 'dr' => 'فیلتر انتصابات'],
        'statistical-reports' => ['en' => 'Statistical Reports', 'ps' => 'احصائیوي راپور', 'dr' => 'گزارش آماری'],
        'vacant-positions' => ['en' => 'Vacant Positions', 'ps' => 'خالي بستونه', 'dr' => 'بست‌های خالی'],
        'department-totals' => ['en' => 'Department Totals', 'ps' => 'د څانګې مجموعه', 'dr' => 'مجموعه ریاست'],
        'assignment-report-by-departments' => ['en' => 'Assignment Report by Departments', 'ps' => 'د څانګې له مخې د ګمارنو راپور', 'dr' => 'گزارش انتصابات بر اساس ریاست'],
        'organizational-structures' => ['en' => 'Organizational Structures', 'ps' => 'تشکیلاتي جوړښت', 'dr' => 'ساختار تشکیلاتی'],
        'department-formations' => ['en' => 'Department Formations', 'ps' => 'د څانګې تشکیل', 'dr' => 'تشکیل ریاست'],
        'formation-archives' => ['en' => 'Formation Archives', 'ps' => 'د تشکیل آرشیف', 'dr' => 'آرشیف تشکیل'],
        'submit-new-formations' => ['en' => 'Submit New Formations', 'ps' => 'نوې تشکیل وړاندې کول', 'dr' => 'ارائه تشکیل جدید'],
        'edit-and-approve-new-formations' => ['en' => 'Edit and Approve New Formations', 'ps' => 'نوې تشکیل تعديل او تائید', 'dr' => 'ویرایش و تأیید تشکیل جدید'],
        'reduced-positions' => ['en' => 'Reduced Positions', 'ps' => 'کم شوي بستونه', 'dr' => 'بست‌های کاهش‌یافته'],
        'archived-positions' => ['en' => 'Archived Positions', 'ps' => 'آرشیف شوي بستونه', 'dr' => 'بست‌های آرشیف‌شده'],
        'formation-filters' => ['en' => 'Formation Filters', 'ps' => 'د تشکیل فلټر', 'dr' => 'فیلتر تشکیل'],
        'comparison-tables' => ['en' => 'Comparison Tables', 'ps' => 'د پرتلې جدول', 'dr' => 'جدول مقایسه'],
        'position-details' => ['en' => 'Position Details', 'ps' => 'د بست تفصیلات', 'dr' => 'جزئیات بست'],
        'formation-statistics' => ['en' => 'Formation Statistics', 'ps' => 'د تشکیل احصائیه', 'dr' => 'آمار تشکیل'],
        'organizational-charts' => ['en' => 'Organizational Charts', 'ps' => 'تشکیلاتي چارت', 'dr' => 'چارت تشکیلاتی'],
        'department-statuses' => ['en' => 'Department Statuses', 'ps' => 'د څانګې حالت', 'dr' => 'وضعیت ریاست'],
        'itemized-details' => ['en' => 'Itemized Details', 'ps' => 'جزئي تفصیلات', 'dr' => 'جزئیات تفکیکی'],
        'proposals' => ['en' => 'Proposals', 'ps' => 'پروپوزلونه', 'dr' => 'پیشنهادها'],
        'programs' => ['en' => 'Programs', 'ps' => 'برنامه‌ها', 'dr' => 'برنامه‌ها'],
        'ceilings' => ['en' => 'Ceilings', 'ps' => 'سقف', 'dr' => 'سقف'],
    ];

    private const RESOURCES = [
        '/user-management' => ['users', 'roles', 'permissions', 'employee-activities', 'online-employees', 'update-user-password'],
        '/incidents' => ['incidents', 'incident-reports'],
        '/biographic' => ['employee-details', 'inactive-employees', 'suspended-employees', 'add-vacant-positions', 'check-position-statuses', 'unknown-persons', 'data-entry-reports', 'assignment-lists', 'assignment-filters', 'statistical-reports', 'vacant-positions', 'department-totals', 'assignment-report-by-departments'],
        '/structures' => ['organizational-structure', 'department-formations', 'formation-archives', 'submit-new-formations', 'edit-and-approve-new-formations', 'reduced-positions', 'archived-positions', 'formation-filters', 'comparison-tables', 'position-details', 'formation-statistics', 'organizational-charts', 'department-statuses', 'itemized-details', 'proposals', 'programs', 'ceilings'],
        '/attendances' => ['search-forms', 'employee-lists'],
        '/biometric-verifications' => ['reconciliation-entries', 'create-formation-lists'],
        '/settings' => ['lookups', 'job-types', 'categories', 'category-grade-structures', 'category-job-type-structures', 'post-statuses', 'positions', 'departments', 'type-of-departments', 'finances', 'entitlement-deductions', 'grades', 'type-of-notifications', 'payroll-programs'],
        '/payrolls' => ['payroll-lists', 'reports'],
        '/job-descriptions' => ['job-descriptions', 'copy-job-descriptions-similar-positions', 'job-description-reports'],
        '/request-forms' => [],
    ];

    public function run(): void
    {
        DB::transaction(function (): void {
            $permissions = [];
            $moduleIds = DB::table('modules')->whereIn('url', array_keys(self::MODULES))->pluck('id', 'url')->all();

            foreach (self::MODULES as $url => $names) {
                $moduleId = $moduleIds[$url] ?? null;
                if (!$moduleId) {
                    continue;
                }

                $slug = Str::after($url, '/');

                foreach (self::ACTIONS as $action) {
                    $permissions[] = [
                        'name' => "$slug.$action",
                        'display_name_en' => $this->displayName($names['en'], $action, 'en'),
                        'display_name_ps' => $this->displayName($names['ps'], $action, 'ps'),
                        'display_name_dr' => $this->displayName($names['dr'], $action, 'dr'),
                        'module_id' => $moduleId,
                        'guard_name' => 'web',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }

                foreach (self::RESOURCES[$url] ?? [] as $resource) {
                    $res = self::RESOURCE_NAMES[$resource] ?? [
                        'en' => $this->humanize($resource),
                        'ps' => $this->humanize($resource),
                        'dr' => $this->humanize($resource),
                    ];

                    foreach (self::ACTIONS as $action) {
                        $permissions[] = [
                            'name' => "$slug.$resource.$action",
                            'display_name_en' => $this->displayName($res['en'], $action, 'en'),
                            'display_name_ps' => $this->displayName($res['ps'] ?? $res['en'], $action, 'ps'),
                            'display_name_dr' => $this->displayName($res['dr'] ?? $res['en'], $action, 'dr'),
                            'module_id' => $moduleId,
                            'guard_name' => 'web',
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                }
            }

            DB::table('permissions')->upsert(
                $permissions,
                ['name', 'guard_name'],
                ['display_name_en', 'display_name_ps', 'display_name_dr', 'module_id', 'updated_at']
            );
        });
    }

    private function displayName(string $base, string $action, string $lang): string
    {
        $map = [
            'en' => ['view' => 'View', 'create' => 'Create', 'update' => 'Update', 'delete' => 'Delete', 'restore' => 'Restore', 'force-delete' => 'Force Delete', 'bulk-delete' => 'Bulk Delete', 'export' => 'Export', 'import' => 'Import'],
            'ps' => ['view' => 'کتل', 'create' => 'جوړول', 'update' => 'تجدیدول', 'delete' => 'ړنګول', 'restore' => 'بېرته راګرځول', 'force-delete' => 'په زور ړنګول', 'bulk-delete' => 'ډله ییز ړنګول', 'export' => 'صادرول', 'import' => 'واردول'],
            'dr' => ['view' => 'دیدن', 'create' => 'ایجاد', 'update' => 'ویرایش', 'delete' => 'حذف', 'restore' => 'بازگردانی', 'force-delete' => 'حذف دائمی', 'bulk-delete' => 'حذف گروهی', 'export' => 'صادر کردن', 'import' => 'وارد کردن'],
        ];

        return ($map[$lang][$action] ?? ucfirst(str_replace('-', ' ', $action)))." $base";
    }

    private function humanize(string $text): string
    {
        return ucfirst(str_replace(['-', '_'], ' ', $text));
    }
}
