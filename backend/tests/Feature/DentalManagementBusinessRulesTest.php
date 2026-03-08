<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Entities\PatientQuestion;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
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

    public function test_appointment_tag_is_auto_generated_with_daily_sequence(): void
    {
        $this->actingAsSuperAdmin();

        $patient = $this->createPatient();
        $dentist = $this->createDentist();

        $firstResponse = $this->postJson('/api/v1/dental-management/appointments', [
            'appointmentDate' => '2026-02-22',
            'dentistId' => $dentist->id,
            'endTime' => '09:30',
            'patientId' => $patient->id,
            'startTime' => '09:00',
            'tag' => 'MANUAL-TAG-SHOULD-BE-IGNORED',
        ]);

        $secondResponse = $this->postJson('/api/v1/dental-management/appointments', [
            'appointmentDate' => '2026-02-22',
            'dentistId' => $dentist->id,
            'endTime' => '10:30',
            'patientId' => $patient->id,
            'startTime' => '10:00',
        ]);

        $thirdResponse = $this->postJson('/api/v1/dental-management/appointments', [
            'appointmentDate' => '2026-02-23',
            'dentistId' => $dentist->id,
            'endTime' => '11:30',
            'patientId' => $patient->id,
            'startTime' => '11:00',
        ]);

        $firstResponse->assertCreated();
        $firstResponse->assertJsonPath('data.tag', 'DCA#1#20260222');
        $secondResponse->assertCreated();
        $secondResponse->assertJsonPath('data.tag', 'DCA#2#20260222');
        $thirdResponse->assertCreated();
        $thirdResponse->assertJsonPath('data.tag', 'DCA#1#20260223');
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

    public function test_paid_invoice_without_payment_creates_safe_income_entry(): void
    {
        $this->actingAsSuperAdmin();

        ['patient' => $patient, 'visit' => $visit] = $this->createInvoiceContext();

        $createResponse = $this->postJson('/api/v1/dental-management/invoices', [
            'discount' => 0,
            'invoiceDate' => '2026-02-22',
            'netAmount' => 300,
            'patientId' => $patient->id,
            'status' => 'paid',
            'totalAmount' => 300,
            'visitId' => $visit->id,
        ]);

        $createResponse->assertCreated();
        $invoiceId = (int) $createResponse->json('data.id');

        $this->assertDatabaseHas('safe_transactions', [
            'source_id' => $invoiceId,
            'source_type' => 'invoice',
            'direction' => 'in',
            'entry_type' => 'income',
            'amount' => 300,
        ]);

        $paymentResponse = $this->postJson('/api/v1/dental-management/payments', [
            'amount' => 100,
            'invoiceId' => $invoiceId,
            'method' => 'cash',
            'paymentDate' => '2026-02-22',
        ]);
        $paymentResponse->assertCreated();

        $this->assertSame(
            0,
            SafeTransaction::query()
                ->where('source_type', 'invoice')
                ->where('source_id', $invoiceId)
                ->count()
        );
    }

    public function test_payment_with_afn_currency_is_converted_and_persisted_with_rate_metadata(): void
    {
        $this->actingAsSuperAdmin();

        ['invoice' => $invoice] = $this->createInvoiceContext();

        $response = $this->postJson('/api/v1/dental-management/payments', [
            'amount' => 7000,
            'currency' => 'AFN',
            'exchangeRate' => 70,
            'invoiceId' => $invoice->id,
            'method' => 'cash',
            'paymentDate' => '2026-02-22',
        ]);

        $response->assertCreated();
        $paymentId = (int) $response->json('data.id');

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'amount' => 100.00,
            'amount_input' => 7000.00,
            'currency' => 'AFN',
            'exchange_rate' => 70.000000,
        ]);

        $this->assertDatabaseHas('safe_transactions', [
            'source_type' => 'payment',
            'source_id' => $paymentId,
            'amount' => 100.00,
            'amount_input' => 7000.00,
            'currency' => 'AFN',
            'exchange_rate' => 70.000000,
        ]);
    }

    public function test_exchange_rate_can_be_updated_and_read_from_financial_settings_endpoint(): void
    {
        $this->actingAsSuperAdmin();

        $updateResponse = $this->putJson('/api/v1/dental-management/financial-settings/exchange-rate', [
            'afnPerUsd' => 82.5,
        ]);
        $updateResponse->assertOk();
        $updateResponse->assertJsonPath('data.afnPerUsd', 82.5);

        $showResponse = $this->getJson('/api/v1/dental-management/financial-settings/exchange-rate');
        $showResponse->assertOk();
        $showResponse->assertJsonPath('data.afnPerUsd', 82.5);
    }

    public function test_patient_registration_persists_questionnaire_answers(): void
    {
        $this->actingAsSuperAdmin();

        $requiredQuestion = PatientQuestion::create([
            'question_text' => 'Do you have allergies?',
            'answer_type' => 'yes_no',
            'is_required' => true,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $optionalQuestion = PatientQuestion::create([
            'question_text' => 'Current medication',
            'answer_type' => 'textarea',
            'is_required' => false,
            'is_active' => true,
            'sort_order' => 2,
        ]);

        $response = $this->postJson('/api/v1/dental-management/patients', [
            'firstName' => 'Mary',
            'lastName' => 'Doe',
            'questionnaireResponses' => [
                [
                    'questionId' => $requiredQuestion->id,
                    'answer' => 'yes',
                ],
                [
                    'questionId' => $optionalQuestion->id,
                    'answer' => 'Vitamin C',
                ],
            ],
        ]);

        $response->assertCreated();
        $patientId = (int) $response->json('data.id');

        $this->assertDatabaseHas('patient_question_answers', [
            'patient_id' => $patientId,
            'patient_question_id' => $requiredQuestion->id,
            'answer' => 'yes',
        ]);

        $this->assertDatabaseHas('patient_question_answers', [
            'patient_id' => $patientId,
            'patient_question_id' => $optionalQuestion->id,
            'answer' => 'Vitamin C',
        ]);

        $response->assertJsonCount(2, 'data.questionnaireResponses');
    }

    public function test_patient_question_crud_endpoints_work(): void
    {
        $this->actingAsSuperAdmin();

        $createResponse = $this->postJson('/api/v1/dental-management/patient-questions', [
            'questionText' => 'Last dental visit date',
            'answerType' => 'date',
            'helpText' => 'Ask for the latest visit date.',
            'isActive' => true,
            'isRequired' => false,
            'sortOrder' => 5,
        ]);

        $createResponse->assertCreated();
        $questionId = (int) $createResponse->json('data.id');

        $updateResponse = $this->putJson("/api/v1/dental-management/patient-questions/{$questionId}", [
            'questionText' => 'Last dental checkup date',
            'answerType' => 'date',
            'helpText' => 'Use YYYY-MM-DD.',
            'isActive' => true,
            'isRequired' => true,
            'sortOrder' => 3,
        ]);

        $updateResponse->assertOk();
        $this->assertDatabaseHas('patient_questions', [
            'id' => $questionId,
            'question_text' => 'Last dental checkup date',
            'is_required' => true,
            'sort_order' => 3,
        ]);

        $deleteResponse = $this->deleteJson("/api/v1/dental-management/patient-questions/{$questionId}");
        $deleteResponse->assertOk();
        $this->assertSoftDeleted('patient_questions', ['id' => $questionId]);
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
