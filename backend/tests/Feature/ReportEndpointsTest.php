<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Entities\Debt;
use App\Modules\DentalManagement\Domain\Entities\DentalBackup;
use App\Modules\DentalManagement\Domain\Entities\DentalBackupSchedule;
use App\Modules\DentalManagement\Domain\Entities\Expense;
use App\Modules\DentalManagement\Domain\Entities\InventoryItem;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Entities\PatientSessionTask;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Entities\SalaryPayment;
use App\Modules\DentalManagement\Domain\Entities\Shareholder;
use App\Modules\DentalManagement\Domain\Entities\ShareholderTransaction;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use App\Modules\DentalManagement\Domain\Entities\Treatment;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatmentMaterial;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

final class ReportEndpointsTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_read_endpoints_return_backend_payloads(): void
    {
        $this->actingAsSuperAdmin();
        $this->seedReportDataset();

        $query = '?startDate=2026-02-01&endDate=2026-02-28&granularity=month';

        $this->getJson('/api/v1/dental-management/reports/filter-options'.$query)
            ->assertOk()
            ->assertJsonPath('data.patients.0.name', 'John Doe');

        $this->getJson('/api/v1/dental-management/reports/executive'.$query)
            ->assertOk()
            ->assertJsonPath('data.kpis.billed', 1200);

        $this->getJson('/api/v1/dental-management/reports/financial'.$query)
            ->assertOk()
            ->assertJsonPath('data.summary.paid', 900)
            ->assertJsonCount(1, 'data.tables.outstandingInvoices');

        $this->getJson('/api/v1/dental-management/reports/clinical'.$query)
            ->assertOk()
            ->assertJsonPath('data.summary.prescriptions', 1)
            ->assertJsonPath('data.summary.waitingAppointments', 1)
            ->assertJsonPath('data.summary.lateAppointments', 1)
            ->assertJsonPath('data.tables.queueSnapshot.0.statusKey', 'waiting')
            ->assertJsonPath('data.tables.patientTimeline.0.eventType', 'appointment');

        $this->getJson('/api/v1/dental-management/reports/inventory'.$query)
            ->assertOk()
            ->assertJsonPath('data.summary.totalItems', 1);

        $this->getJson('/api/v1/dental-management/reports/daily-expenses'.$query)
            ->assertOk()
            ->assertJsonPath('data.history.meta.total', 1);

        $this->getJson('/api/v1/dental-management/reports/clinical-expenses'.$query)
            ->assertOk()
            ->assertJsonPath('data.history.meta.total', 1);

        $this->getJson('/api/v1/dental-management/reports/debts'.$query)
            ->assertOk()
            ->assertJsonPath('data.summary.debtCount', 1);

        $this->getJson('/api/v1/dental-management/reports/safe'.$query)
            ->assertOk()
            ->assertJsonPath('data.ledger.meta.total', 2);

        $this->getJson('/api/v1/dental-management/reports/salaries'.$query)
            ->assertOk()
            ->assertJsonPath('data.summary.totalCount', 1);

        $this->getJson('/api/v1/dental-management/reports/shareholders'.$query)
            ->assertOk()
            ->assertJsonPath('data.summary.totalShareholders', 1);

        $this->getJson('/api/v1/dental-management/reports/audit'.$query)
            ->assertOk()
            ->assertJsonPath('data.summary.modificationCount', 1)
            ->assertJsonPath('data.summary.failedBackupCount', 1)
            ->assertJsonCount(2, 'data.recentBackups');
    }

    public function test_report_exports_stream_csv_from_backend(): void
    {
        $this->actingAsSuperAdmin();
        $this->seedReportDataset();

        $response = $this->get('/api/v1/dental-management/reports/exports/executive_summary?startDate=2026-02-01&endDate=2026-02-28&format=csv');

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('Metric,Value', $response->streamedContent());
        $this->assertStringContainsString('Billed,1200', $response->streamedContent());

        $safeResponse = $this->get('/api/v1/dental-management/reports/exports/financial_daily_safe?startDate=2026-02-01&endDate=2026-02-28&format=csv');

        $safeResponse->assertOk();
        $this->assertStringContainsString('Date,Direction,"Entry Type",Amount,"Picked By",Notes', $safeResponse->streamedContent());
        $this->assertStringContainsString('2026-02-12,out,expense,100', $safeResponse->streamedContent());

        $patientResponse = $this->get('/api/v1/dental-management/reports/exports/financial_patient_details?startDate=2026-02-01&endDate=2026-02-28&format=csv');

        $patientResponse->assertOk();
        $this->assertStringContainsString('"Patient ID",Patient,"Total Net Amount","Total Paid Amount","Total Debt Amount","Open Invoices","Last Invoice Date","Invoice IDs","Account Status"', $patientResponse->streamedContent());
        $this->assertStringContainsString('1,"John Doe",1200,900,300,1,2026-02-10,1,"Has unpaid balance"', $patientResponse->streamedContent());
    }

    public function test_snapshot_endpoints_persist_and_schedule_reports(): void
    {
        $this->actingAsSuperAdmin();
        $this->seedReportDataset();

        $this->postJson('/api/v1/dental-management/reports/snapshots', [
            'filters' => [
                'startDate' => '2026-02-01',
                'endDate' => '2026-02-28',
                'granularity' => 'month',
            ],
            'reportKey' => 'executive',
        ])
            ->assertCreated()
            ->assertJsonPath('data.payload.kpis.billed', 1200);

        $this->putJson('/api/v1/dental-management/reports/snapshot-schedule', [
            'cadence' => 'weekly',
            'filters' => [
                'startDate' => '2026-02-01',
                'endDate' => '2026-02-28',
            ],
            'reportKey' => 'executive',
        ])
            ->assertOk()
            ->assertJsonPath('data.cadence', 'weekly');

        $this->getJson('/api/v1/dental-management/reports/snapshots?reportKey=executive')
            ->assertOk()
            ->assertJsonPath('data.0.reportKey', 'executive');

        $this->assertDatabaseHas('report_snapshots', [
            'report_key' => 'executive',
            'reason' => 'manual',
        ]);

        $this->assertDatabaseHas('report_snapshot_schedules', [
            'report_key' => 'executive',
            'cadence' => 'weekly',
        ]);
    }

    public function test_financial_control_endpoints_return_close_day_data(): void
    {
        $this->actingAsSuperAdmin();
        $this->seedReportDataset();

        $this->getJson('/api/v1/dental-management/reports/financial-control?closingDate=2026-02-12')
            ->assertOk()
            ->assertJsonPath('data.summary.expectedBalance', 1900)
            ->assertJsonPath('data.summary.openDebtCount', 1)
            ->assertJsonPath('data.summary.openDebtTotal', 300);

        $this->postJson('/api/v1/dental-management/reports/financial-control/close-day', [
            'closingDate' => '2026-02-12',
            'countedBalance' => 1850,
            'notes' => 'Short by cash drawer recount',
        ])
            ->assertOk()
            ->assertJsonPath('data.currentClose.closingDate', '2026-02-12')
            ->assertJsonPath('data.currentClose.countedBalance', 1850)
            ->assertJsonPath('data.currentClose.discrepancyAmount', -50)
            ->assertJsonPath('data.closeHistory.0.notes', 'Short by cash drawer recount');

        $this->getJson('/api/v1/dental-management/reports/financial?startDate=2026-02-01&endDate=2026-02-28&granularity=month')
            ->assertOk()
            ->assertJsonPath('data.summary.closeCount', 1)
            ->assertJsonPath('data.summary.latestCloseDifference', -50)
            ->assertJsonPath('data.tables.dailyCloseRows.0.closingDate', '2026-02-12');
    }

    public function test_clinical_report_surfaces_treatment_correction_history(): void
    {
        $this->actingAsSuperAdmin();
        $this->seedReportDataset();

        $visitTreatment = VisitTreatment::query()->firstOrFail();

        $this->putJson("/api/v1/dental-management/visit-treatments/{$visitTreatment->id}", [
            'visitId' => $visitTreatment->visit_id,
            'treatmentId' => $visitTreatment->treatment_id,
            'toothNumber' => '27,28',
            'price' => '1350.00',
            'notes' => '[chart:27=i,28=i][priceInput:1350.00] Correction note',
            'correctionReason' => 'Adjusted treatment pricing after chart review',
            'materialItems' => [],
            'prescription' => ['content' => '', 'items' => []],
            'retainedTreatmentImageIds' => [],
        ])
            ->assertOk();

        $this->getJson('/api/v1/dental-management/visit-treatments?include[]=activityLogs&include[]=activityLogs.causer')
            ->assertOk()
            ->assertJsonPath('data.data.0.correctionHistory.0.event', 'corrected')
            ->assertJsonPath('data.data.0.correctionHistory.0.correctionReason', 'Adjusted treatment pricing after chart review');

        $this->getJson('/api/v1/dental-management/reports/clinical?startDate=2026-02-01&endDate=2026-03-31&granularity=month')
            ->assertOk()
            ->assertJsonPath('data.summary.correctedTreatments', 1)
            ->assertJsonPath('data.tables.treatmentCorrections.0.correctionReason', 'Adjusted treatment pricing after chart review')
            ->assertJsonPath('data.tables.treatmentCorrections.0.treatmentName', 'Implant Crown');
    }

    public function test_inventory_adjustments_feed_inventory_report_pressure_and_waste_metrics(): void
    {
        $this->actingAsSuperAdmin();
        $this->seedReportDataset();

        $inventoryItem = InventoryItem::query()->firstOrFail();

        $this->postJson("/api/v1/dental-management/inventory-items/{$inventoryItem->id}/adjustments", [
            'adjustmentType' => 'waste',
            'quantity' => 8,
            'adjustmentDate' => '2026-02-18',
            'notes' => 'Damaged while sterilizing',
        ])
            ->assertCreated()
            ->assertJsonPath('data.adjustmentType', 'waste')
            ->assertJsonPath('data.quantity', 8);

        $this->getJson('/api/v1/dental-management/inventory-adjustments?perPage=10')
            ->assertOk()
            ->assertJsonPath('data.data.0.adjustmentType', 'waste')
            ->assertJsonPath('data.data.0.itemName', 'Implant Screw');

        $this->getJson('/api/v1/dental-management/reports/inventory?startDate=2026-02-01&endDate=2026-02-28&granularity=month')
            ->assertOk()
            ->assertJsonPath('data.summary.stockPressureCount', 1)
            ->assertJsonPath('data.summary.wasteLossQuantity', 8)
            ->assertJsonPath('data.tables.adjustmentRows.0.adjustmentType', 'waste');
    }

    public function test_backup_settings_surface_health_and_restore_readiness(): void
    {
        $this->actingAsSuperAdmin();
        $this->seedReportDataset();

        $settingsResponse = $this->getJson('/api/v1/dental-management/backups/settings')
            ->assertOk()
            ->assertJsonPath('data.health.summary.failedBackupCount', 1)
            ->assertJsonPath('data.lastSuccessfulBackup.status', 'completed');

        $backupId = (int) data_get($settingsResponse->json(), 'data.lastSuccessfulBackup.id');

        $this->getJson("/api/v1/dental-management/backups/{$backupId}/restore-readiness")
            ->assertOk()
            ->assertJsonPath('data.backup.id', $backupId)
            ->assertJsonPath('data.readiness.fileExists', true)
            ->assertJsonPath('data.readiness.restorable', true);
    }

    public function test_workflow_rights_restrict_financial_close_audit_and_safe_mutation(): void
    {
        $this->actingAsWorkflowUser('review', [
            'dental-management.view',
            'dental-management.backups.view',
            'dental-management.backups.create',
            'dental-management.payments.delete',
            'dental-management.payments.update',
            'dental-management.invoices.delete',
        ]);

        $this->seedReportDataset();

        $this->getJson('/api/v1/dental-management/workflow/access-summary')
            ->assertOk()
            ->assertJsonPath('data.user.rightLevel', 'review')
            ->assertJsonPath('data.capabilities.canAccessFinancialReports', true)
            ->assertJsonPath('data.capabilities.canAccessAuditReports', false)
            ->assertJsonPath('data.capabilities.canCloseFinancialDay', false)
            ->assertJsonPath('data.capabilities.canDeletePayments', false)
            ->assertJsonPath('data.capabilities.canRunBackups', true);

        $this->getJson('/api/v1/dental-management/reports/financial?startDate=2026-02-01&endDate=2026-02-28&granularity=month')
            ->assertOk();

        $this->getJson('/api/v1/dental-management/reports/audit?startDate=2026-02-01&endDate=2026-02-28&granularity=month')
            ->assertForbidden();

        $this->postJson('/api/v1/dental-management/reports/financial-control/close-day', [
            'closingDate' => '2026-02-12',
            'countedBalance' => 1850,
        ])->assertForbidden();

        $this->postJson('/api/v1/dental-management/safe-transactions', [
            'transactionDate' => '2026-02-20',
            'entryType' => 'deposit',
            'direction' => 'in',
            'amount' => 10,
            'amountInput' => 10,
        ])->assertForbidden();

        $this->deleteJson('/api/v1/dental-management/payments/1')
            ->assertForbidden();

        $this->actingAsWorkflowUser('approval', [
            'dental-management.view',
            'dental-management.backups.view',
            'dental-management.backups.create',
            'dental-management.backups.update',
            'dental-management.payments.delete',
            'dental-management.payments.update',
            'dental-management.invoices.delete',
        ]);

        $this->getJson('/api/v1/dental-management/workflow/access-summary')
            ->assertOk()
            ->assertJsonPath('data.user.rightLevel', 'approval')
            ->assertJsonPath('data.capabilities.canAccessAuditReports', true)
            ->assertJsonPath('data.capabilities.canCloseFinancialDay', true)
            ->assertJsonPath('data.capabilities.canDeletePayments', true)
            ->assertJsonPath('data.capabilities.canManageBackupSettings', true);

        $this->getJson('/api/v1/dental-management/reports/audit?startDate=2026-02-01&endDate=2026-02-28&granularity=month')
            ->assertOk();
    }

    private function actingAsSuperAdmin(): User
    {
        $user = User::create([
            'email' => 'reports-admin@example.test',
            'first_name' => 'Reports',
            'last_name' => 'Admin',
            'job_title' => 'Administrator',
            'password' => Hash::make('password'),
        ]);

        DB::table('roles')->insert([
            'created_at' => now(),
            'display_name_dr' => 'Ù…Ø¯ÛŒØ± Ú©Ù„',
            'display_name_en' => 'Super Administrator',
            'display_name_ps' => 'Ø³ÙˆÙ¾Ø± Ù…Ø¯ÛŒØ±',
            'guard_name' => 'web',
            'name' => 'super-admin',
            'updated_at' => now(),
        ]);

        $user->assignRole('super-admin');
        Sanctum::actingAs($user);

        return $user;
    }

    /**
     * @param array<int, string> $permissions
     */
    private function actingAsWorkflowUser(string $rights, array $permissions): User
    {
        $user = User::create([
            'email' => "{$rights}-user@example.test",
            'first_name' => ucfirst($rights),
            'last_name' => 'Workflow',
            'job_title' => 'Staff',
            'password' => Hash::make('password'),
            'rights' => $rights,
        ]);

        foreach ($permissions as $permission) {
            DB::table('permissions')->updateOrInsert(
                ['guard_name' => 'web', 'name' => $permission],
                [
                    'display_name_dr' => $permission,
                    'display_name_en' => $permission,
                    'display_name_ps' => $permission,
                    'module_id' => null,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $user->givePermissionTo($permissions);
        Sanctum::actingAs($user);

        return $user;
    }

    private function seedReportDataset(): void
    {
        $patient = Patient::create([
            'first_name' => 'John',
            'last_name' => 'Doe',
            'patient_code' => 'P-1001',
        ]);

        $dentist = Staff::create([
            'full_name' => 'Dr. Jane Doe',
            'role' => 'dentist',
        ]);

        $appointment = Appointment::create([
            'patient_id' => $patient->id,
            'dentist_id' => $dentist->id,
            'appointment_date' => '2026-02-10',
            'start_time' => '10:00',
            'end_time' => '10:30',
            'status' => 'completed',
        ]);

        Appointment::create([
            'patient_id' => $patient->id,
            'dentist_id' => $dentist->id,
            'appointment_date' => '2026-02-20',
            'start_time' => '11:00',
            'end_time' => '11:30',
            'status' => 'waiting',
        ]);

        $visit = Visit::create([
            'appointment_id' => $appointment->id,
            'patient_id' => $patient->id,
            'dentist_id' => $dentist->id,
            'visit_date' => '2026-02-10',
        ]);

        $treatment = Treatment::create([
            'name' => 'Implant Crown',
            'category' => 'Implant',
            'default_price' => 1200,
            'duration_minutes' => 60,
        ]);

        $visitTreatment = VisitTreatment::create([
            'visit_id' => $visit->id,
            'treatment_id' => $treatment->id,
            'dentist_id' => $dentist->id,
            'price' => 1200,
            'notes' => '[condition:implant]',
        ]);

        DB::table('prescriptions')->insert([
            'visit_treatment_id' => $visitTreatment->id,
            'visit_id' => $visit->id,
            'patient_id' => $patient->id,
            'dentist_id' => $dentist->id,
            'content' => 'Take after meals',
            'medicine_name' => 'Pain Relief',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Invoice::create([
            'patient_id' => $patient->id,
            'visit_id' => $visit->id,
            'total_amount' => 1200,
            'total_amount_input' => 1200,
            'discount' => 0,
            'discount_input' => 0,
            'net_amount' => 1200,
            'net_amount_input' => 1200,
            'invoice_date' => '2026-02-10',
            'status' => 'unpaid',
        ]);

        $invoice = Invoice::query()->firstOrFail();

        Payment::create([
            'invoice_id' => $invoice->id,
            'payment_date' => '2026-02-11',
            'amount' => 900,
            'amount_input' => 900,
            'method' => 'cash',
        ]);

        Expense::create([
            'expense_type' => 'daily',
            'title' => 'Utilities',
            'category' => 'Utilities',
            'amount' => 100,
            'amount_input' => 100,
            'expense_date' => '2026-02-12',
            'payment_method' => 'cash',
            'staff_id' => $dentist->id,
        ]);

        Expense::create([
            'expense_type' => 'clinical',
            'title' => 'Implant Kit',
            'category' => 'Implants',
            'amount' => 300,
            'amount_input' => 300,
            'expense_date' => '2026-02-12',
            'payment_method' => 'bank_transfer',
            'quantity' => 1,
            'unit_cost' => 300,
            'unit_cost_input' => 300,
            'vendor' => 'Dental Supply',
        ]);

        SafeTransaction::create([
            'transaction_date' => '2026-02-01',
            'entry_type' => 'deposit',
            'direction' => 'in',
            'amount' => 2000,
            'amount_input' => 2000,
        ]);

        SafeTransaction::create([
            'transaction_date' => '2026-02-12',
            'entry_type' => 'expense',
            'direction' => 'out',
            'amount' => 100,
            'amount_input' => 100,
            'picked_by_staff_id' => $dentist->id,
        ]);

        SalaryPayment::create([
            'staff_id' => $dentist->id,
            'salary_month' => '2026-02',
            'payment_date' => '2026-02-15',
            'gross_amount' => 600,
            'gross_amount_input' => 600,
            'bonus_amount' => 0,
            'bonus_amount_input' => 0,
            'deduction_amount' => 0,
            'deduction_amount_input' => 0,
            'net_amount' => 600,
            'net_amount_input' => 600,
            'status' => 'paid',
            'paid_from_safe' => true,
        ]);

        $shareholder = Shareholder::create([
            'full_name' => 'Investor One',
            'ownership_percentage' => 50,
            'initial_capital' => 5000,
            'initial_capital_input' => 5000,
            'status' => 'active',
        ]);

        ShareholderTransaction::create([
            'shareholder_id' => $shareholder->id,
            'transaction_date' => '2026-02-16',
            'transaction_type' => 'contribution',
            'amount' => 1000,
            'amount_input' => 1000,
        ]);

        Debt::create([
            'invoice_id' => $invoice->id,
            'patient_id' => $patient->id,
            'invoice_date' => '2026-02-10',
            'net_amount' => 1200,
            'paid_amount' => 900,
            'debt_amount' => 300,
            'status' => 'open',
            'currency' => 'AFN',
        ]);

        $inventoryItem = InventoryItem::create([
            'acquisition_source' => 'purchase',
            'item_name' => 'Implant Screw',
            'category' => 'implant',
            'entry_date' => '2026-02-05',
            'quantity' => 10,
            'unit' => 'piece',
            'min_stock' => 2,
            'unit_cost' => 50,
            'total_cost' => 500,
            'supplier' => 'Dental Supply',
        ]);

        VisitTreatmentMaterial::create([
            'visit_treatment_id' => $visitTreatment->id,
            'inventory_item_id' => $inventoryItem->id,
            'item_name' => 'Implant Screw',
            'unit' => 'pcs',
            'quantity_used' => 2,
        ]);

        PatientSessionTask::create([
            'patient_id' => $patient->id,
            'title' => 'Implant tooth 12',
            'status' => 'done',
            'notes' => '[implant_tooth:12][implant_availability:done][supplier_total:400][supplier_paid:250]',
        ]);

        DB::table(config('activitylog.table_name'))->insert([
            'log_name' => 'Expense',
            'description' => 'Expense updated',
            'subject_type' => Expense::class,
            'subject_id' => 1,
            'event' => 'updated',
            'causer_type' => User::class,
            'causer_id' => User::query()->firstOrFail()->id,
            'properties' => json_encode([
                'old' => ['amount_input' => 90],
                'attributes' => ['amount_input' => 100],
            ], JSON_THROW_ON_ERROR),
            'created_at' => '2026-02-20 10:00:00',
            'updated_at' => '2026-02-20 10:00:00',
        ]);

        Storage::disk('local')->makeDirectory('dental-backups');
        Storage::disk('local')->put('dental-backups/report-test-success.sql', 'select 1;');
        Storage::disk('local')->put('dental-backups/report-test-failed.sql', 'broken backup');

        DentalBackupSchedule::create([
            'frequency' => 'daily',
            'run_at_time' => '02:00',
            'is_active' => true,
            'last_run_at' => now()->subDay(),
        ]);

        DentalBackup::create([
            'mode' => 'full',
            'status' => 'completed',
            'file_path' => 'dental-backups/report-test-success.sql',
            'file_size_bytes' => 9,
            'summary' => [
                'format' => 'sql_inserts',
                'tables' => [
                    'patients' => ['count' => 1],
                    'visits' => ['count' => 1],
                ],
            ],
            'notes' => 'Successful backup',
            'completed_at' => now()->subHours(12),
            'created_at' => now()->subHours(12),
            'updated_at' => now()->subHours(12),
        ]);

        DentalBackup::create([
            'mode' => 'full',
            'status' => 'failed',
            'file_path' => 'dental-backups/report-test-failed.sql',
            'file_size_bytes' => 13,
            'summary' => ['format' => 'sql_inserts'],
            'notes' => 'Disk space warning during backup',
            'completed_at' => now()->subHours(3),
            'created_at' => now()->subHours(3),
            'updated_at' => now()->subHours(3),
        ]);
    }
}
