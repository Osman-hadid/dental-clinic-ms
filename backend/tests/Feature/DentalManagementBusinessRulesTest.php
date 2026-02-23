<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class DentalManagementBusinessRulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_appointment_overlap_is_rejected_for_same_dentist(): void
    {
        $this->actingAsSuperAdmin();

        $patient = $this->createPatient();
        $dentist = $this->createDentist();

        Appointment::create([
            'patient_id' => $patient->id,
            'dentist_id' => $dentist->id,
            'appointment_date' => '2026-02-22',
            'start_time' => '10:00',
            'end_time' => '11:00',
            'status' => 'scheduled',
        ]);

        $response = $this->postJson('/api/v1/dental-management/appointments', [
            'appointmentDate' => '2026-02-22',
            'dentistId' => $dentist->id,
            'endTime' => '10:30',
            'patientId' => $patient->id,
            'startTime' => '10:15',
            'status' => 'scheduled',
        ]);

        $response->assertStatus(409);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('error.code', 'APPOINTMENT_TIME_CONFLICT');
    }

    public function test_payment_cannot_exceed_invoice_balance(): void
    {
        $this->actingAsSuperAdmin();

        ['invoice' => $invoice] = $this->createInvoiceContext();

        Payment::create([
            'amount' => 80,
            'invoice_id' => $invoice->id,
            'method' => 'cash',
            'payment_date' => '2026-02-22',
        ]);

        $response = $this->postJson('/api/v1/dental-management/payments', [
            'amount' => 30,
            'invoiceId' => $invoice->id,
            'method' => 'cash',
            'paymentDate' => '2026-02-22',
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('error.code', 'PAYMENT_AMOUNT_EXCEEDS_INVOICE');
    }

    public function test_payment_lifecycle_keeps_invoice_status_in_sync(): void
    {
        $this->actingAsSuperAdmin();

        ['invoice' => $invoice] = $this->createInvoiceContext();

        $createResponse = $this->postJson('/api/v1/dental-management/payments', [
            'amount' => 100,
            'invoiceId' => $invoice->id,
            'method' => 'cash',
            'paymentDate' => '2026-02-22',
        ]);

        $createResponse->assertCreated();
        $createResponse->assertJsonPath('success', true);

        $invoice->refresh();
        $this->assertSame('paid', $invoice->status);

        $paymentId = (int) $createResponse->json('data.id');

        $deleteResponse = $this->deleteJson("/api/v1/dental-management/payments/{$paymentId}");
        $deleteResponse->assertOk();
        $deleteResponse->assertJsonPath('success', true);

        $invoice->refresh();
        $this->assertSame('unpaid', $invoice->status);
    }

    private function actingAsSuperAdmin(): User
    {
        $user = User::create([
            'email' => 'super-admin@example.test',
            'first_name' => 'Super',
            'job_title' => 'Administrator',
            'password' => Hash::make('password'),
        ]);

        DB::table('roles')->insert([
            'created_at' => now(),
            'display_name_dr' => 'مدیر کل',
            'display_name_en' => 'Super Administrator',
            'display_name_ps' => 'سوپر مدیر',
            'guard_name' => 'web',
            'name' => 'super-admin',
            'updated_at' => now(),
        ]);

        $user->assignRole('super-admin');
        Sanctum::actingAs($user);

        return $user;
    }

    private function createInvoiceContext(): array
    {
        $patient = $this->createPatient();
        $dentist = $this->createDentist();

        $appointment = Appointment::create([
            'patient_id' => $patient->id,
            'dentist_id' => $dentist->id,
            'appointment_date' => '2026-02-22',
            'start_time' => '09:00',
            'end_time' => '09:30',
            'status' => 'scheduled',
        ]);

        $visit = Visit::create([
            'appointment_id' => $appointment->id,
            'patient_id' => $patient->id,
            'dentist_id' => $dentist->id,
            'visit_date' => '2026-02-22',
        ]);

        $invoice = Invoice::create([
            'discount' => 0,
            'invoice_date' => '2026-02-22',
            'net_amount' => 100,
            'patient_id' => $patient->id,
            'status' => 'unpaid',
            'total_amount' => 100,
            'visit_id' => $visit->id,
        ]);

        return compact('appointment', 'dentist', 'invoice', 'patient', 'visit');
    }

    private function createPatient(): Patient
    {
        return Patient::create([
            'first_name' => 'John',
            'patient_code' => 'P-'.random_int(1000, 9999),
        ]);
    }

    private function createDentist(): Staff
    {
        return Staff::create([
            'full_name' => 'Dr. Jane',
            'role' => 'dentist',
        ]);
    }
}
