<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Entities\Debt;
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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
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
            ->assertJsonPath('data.summary.prescriptions', 1);

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
            ->assertJsonPath('data.summary.modificationCount', 1);
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
    }
}
