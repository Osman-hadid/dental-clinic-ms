<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Entities\Expense;
use App\Modules\DentalManagement\Domain\Entities\ImplantCompany;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Entities\PatientSessionTask;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Entities\SalaryPayment;
use App\Modules\DentalManagement\Domain\Entities\Shareholder;
use App\Modules\DentalManagement\Domain\Entities\ShareholderTransaction;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

final class ReportDatasetService
{
    public function buildClinical(array $filters): array
    {
        [$startDate, $endDate] = $this->resolveDateRange($filters);

        $patients = Patient::query()
            ->select(['id', 'patient_code', 'first_name', 'last_name', 'created_at', 'updated_at'])
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get();

        $appointments = Appointment::query()
            ->select(['id', 'patient_id', 'dentist_id', 'appointment_date', 'status', 'created_at', 'updated_at'])
            ->with(['dentist:id,full_name'])
            ->where('appointment_date', '>=', $startDate->toDateString())
            ->where('appointment_date', '<=', $endDate->toDateString())
            ->get();

        $visits = Visit::query()
            ->select(['id', 'patient_id', 'dentist_id', 'tag', 'visit_date', 'created_at', 'updated_at'])
            ->with(['dentist:id,full_name'])
            ->where('visit_date', '>=', $startDate->toDateString())
            ->where('visit_date', '<=', $endDate->toDateString())
            ->get();

        $visitTreatments = VisitTreatment::query()
            ->select(['id', 'visit_id', 'treatment_id', 'price', 'notes', 'created_at', 'updated_at'])
            ->with([
                'prescription:id,visit_treatment_id,content,medicine_name,dosage_unit,dosage_amount,frequency,food_timing,created_at,updated_at',
                'prescription.items:id,prescription_id,name,unit,amount,frequency,food_timing,created_at,updated_at',
                'treatment:id,name,category',
                'visit:id,patient_id,dentist_id,visit_date',
                'visit.dentist:id,full_name',
            ])
            ->whereHas('visit', static function ($query) use ($startDate, $endDate): void {
                $query
                    ->where('visit_date', '>=', $startDate->toDateString())
                    ->where('visit_date', '<=', $endDate->toDateString());
            })
            ->get();

        $tasks = PatientSessionTask::query()
            ->select(['id', 'patient_id', 'implant_company_id', 'title', 'status', 'notes', 'created_at', 'updated_at'])
            ->where('created_at', '>=', $startDate->startOfDay())
            ->where('created_at', '<=', $endDate->endOfDay())
            ->get();

        $invoices = Invoice::query()
            ->select([
                'id',
                'patient_id',
                'visit_id',
                'total_amount',
                'total_amount_input',
                'discount',
                'discount_input',
                'net_amount',
                'net_amount_input',
                'exchange_rate',
                'invoice_date',
                'status',
            ])
            ->with(['payments:id,invoice_id,payment_date,amount,amount_input,method,exchange_rate'])
            ->where('invoice_date', '>=', $startDate->toDateString())
            ->where('invoice_date', '<=', $endDate->toDateString())
            ->get();

        return [
            'appointments' => $appointments->map(fn (Appointment $appointment): array => $this->appointmentRow($appointment))->values()->all(),
            'invoiceRows' => $invoices->map(fn (Invoice $invoice): array => $this->invoiceRow($invoice))->values()->all(),
            'patientNameMap' => $this->patientNameMap($patients),
            'patientSessionTasks' => $tasks->map(fn (PatientSessionTask $task): array => $this->taskRow($task))->values()->all(),
            'patients' => $patients->map(fn (Patient $patient): array => $this->patientRow($patient))->values()->all(),
            'visitTreatments' => $visitTreatments->map(fn (VisitTreatment $visitTreatment): array => $this->visitTreatmentRow($visitTreatment, true))->values()->all(),
            'visits' => $visits->map(fn (Visit $visit): array => $this->visitRow($visit))->values()->all(),
        ];
    }

    public function buildFinancial(array $filters): array
    {
        [$startDate, $endDate] = $this->resolveDateRange($filters);

        $patients = Patient::query()
            ->select(['id', 'patient_code', 'first_name', 'last_name', 'created_at', 'updated_at'])
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get();

        $visits = Visit::query()
            ->select(['id', 'patient_id', 'dentist_id', 'tag', 'visit_date', 'created_at', 'updated_at'])
            ->with(['dentist:id,full_name'])
            ->where('visit_date', '>=', $startDate->toDateString())
            ->where('visit_date', '<=', $endDate->toDateString())
            ->get();

        $invoices = Invoice::query()
            ->select([
                'id',
                'patient_id',
                'visit_id',
                'total_amount',
                'total_amount_input',
                'discount',
                'discount_input',
                'net_amount',
                'net_amount_input',
                'exchange_rate',
                'invoice_date',
                'status',
            ])
            ->with(['payments:id,invoice_id,payment_date,amount,amount_input,method,exchange_rate'])
            ->where('invoice_date', '>=', $startDate->toDateString())
            ->where('invoice_date', '<=', $endDate->toDateString())
            ->get();

        $visitTreatments = VisitTreatment::query()
            ->select(['id', 'visit_id', 'treatment_id', 'price', 'notes', 'created_at', 'updated_at'])
            ->with([
                'treatment:id,name,category',
                'visit:id,patient_id,dentist_id,visit_date',
                'visit.dentist:id,full_name',
            ])
            ->whereHas('visit', static function ($query) use ($startDate, $endDate): void {
                $query
                    ->where('visit_date', '>=', $startDate->toDateString())
                    ->where('visit_date', '<=', $endDate->toDateString());
            })
            ->get();

        $expenses = Expense::query()
            ->select([
                'id',
                'amount',
                'amount_input',
                'category',
                'expense_date',
                'expense_type',
                'exchange_rate',
            ])
            ->where('expense_date', '>=', $startDate->toDateString())
            ->where('expense_date', '<=', $endDate->toDateString())
            ->get();

        $safeTransactions = SafeTransaction::query()
            ->select([
                'id',
                'amount',
                'amount_input',
                'direction',
                'entry_type',
                'notes',
                'picked_by_staff_id',
                'transaction_date',
                'exchange_rate',
            ])
            ->with(['pickedByStaff:id,full_name'])
            ->where('transaction_date', '>=', $startDate->toDateString())
            ->where('transaction_date', '<=', $endDate->toDateString())
            ->get();

        $salaryPayments = SalaryPayment::query()
            ->select([
                'id',
                'staff_id',
                'net_amount',
                'net_amount_input',
                'payment_date',
                'status',
                'exchange_rate',
            ])
            ->with(['staff:id,full_name'])
            ->where('payment_date', '>=', $startDate->toDateString())
            ->where('payment_date', '<=', $endDate->toDateString())
            ->get();

        $shareholders = Shareholder::query()
            ->select([
                'id',
                'full_name',
                'status',
                'initial_capital_input',
                'ownership_percentage',
            ])
            ->withSum(['transactions as total_contribution_amount' => static function ($query): void {
                $query->where('transaction_type', 'contribution');
            }], 'amount')
            ->withSum(['transactions as total_distribution_amount' => static function ($query): void {
                $query->where('transaction_type', 'distribution');
            }], 'amount')
            ->orderBy('full_name')
            ->get();

        $shareholderTransactions = ShareholderTransaction::query()
            ->select([
                'id',
                'shareholder_id',
                'amount',
                'amount_input',
                'notes',
                'transaction_date',
                'transaction_type',
            ])
            ->with(['shareholder:id,full_name'])
            ->where('transaction_date', '>=', $startDate->toDateString())
            ->where('transaction_date', '<=', $endDate->toDateString())
            ->get();

        $tasks = PatientSessionTask::query()
            ->select(['id', 'patient_id', 'implant_company_id', 'title', 'status', 'notes', 'created_at', 'updated_at'])
            ->where('created_at', '>=', $startDate->startOfDay())
            ->where('created_at', '<=', $endDate->endOfDay())
            ->get();

        $implantCompanies = ImplantCompany::query()
            ->select(['id', 'company_name', 'implant_type', 'record_date', 'note', 'created_at', 'updated_at'])
            ->orderBy('company_name')
            ->orderBy('implant_type')
            ->orderByDesc('record_date')
            ->get();

        return [
            'expenseRows' => $expenses->map(fn (Expense $expense): array => $this->expenseRow($expense))->values()->all(),
            'implantCompanies' => $implantCompanies->map(fn (ImplantCompany $company): array => $this->implantCompanyRow($company))->values()->all(),
            'invoiceRows' => $invoices->map(fn (Invoice $invoice): array => $this->invoiceRow($invoice))->values()->all(),
            'patientNameMap' => $this->patientNameMap($patients),
            'patientSessionTasks' => $tasks->map(fn (PatientSessionTask $task): array => $this->taskRow($task))->values()->all(),
            'patients' => $patients->map(fn (Patient $patient): array => $this->patientRow($patient))->values()->all(),
            'safeRows' => $safeTransactions->map(fn (SafeTransaction $safeTransaction): array => $this->safeTransactionRow($safeTransaction))->values()->all(),
            'salaryRows' => $salaryPayments->map(fn (SalaryPayment $salaryPayment): array => $this->salaryPaymentRow($salaryPayment))->values()->all(),
            'shareholderRows' => $shareholders->map(fn (Shareholder $shareholder): array => $this->shareholderRow($shareholder))->values()->all(),
            'shareholderTransactionRows' => $shareholderTransactions->map(fn (ShareholderTransaction $transaction): array => $this->shareholderTransactionRow($transaction))->values()->all(),
            'visitTreatmentRows' => $visitTreatments->map(fn (VisitTreatment $visitTreatment): array => $this->visitTreatmentRow($visitTreatment, false))->values()->all(),
            'visits' => $visits->map(fn (Visit $visit): array => $this->visitRow($visit))->values()->all(),
        ];
    }

    private function appointmentRow(Appointment $appointment): array
    {
        return [
            'appointmentDate' => $this->dateString($appointment->appointment_date),
            'createdAt' => $this->dateTimeString($appointment->created_at),
            'dentistId' => (string) ($appointment->dentist_id ?? ''),
            'dentistName' => $this->dentistName($appointment->dentist?->full_name, $appointment->dentist_id),
            'endTime' => trim((string) ($appointment->end_time ?? '')),
            'id' => (string) $appointment->id,
            'patientId' => (string) ($appointment->patient_id ?? ''),
            'startTime' => trim((string) ($appointment->start_time ?? '')),
            'status' => (string) ($appointment->status ?? ''),
            'tag' => (string) ($appointment->tag ?? ''),
            'updatedAt' => $this->dateTimeString($appointment->updated_at),
        ];
    }

    private function dateString(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return trim((string) ($value ?? ''));
    }

    private function dateTimeString(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        return trim((string) ($value ?? ''));
    }

    private function dentistName(?string $fullName, mixed $dentistId): string
    {
        $name = trim((string) ($fullName ?? ''));
        if ($name !== '') {
            return $name;
        }

        $id = trim((string) ($dentistId ?? ''));

        return $id !== '' ? "Dentist #{$id}" : '';
    }

    private function expenseRow(Expense $expense): array
    {
        return [
            'amount' => $this->toFloat($expense->amount ?? 0),
            'amountInput' => $this->toFloat($expense->amount_input ?? $expense->amount ?? 0),
            'category' => $this->stringOrFallback($expense->category ?? null, 'Other'),
            'exchangeRate' => $this->toFloat($expense->exchange_rate ?? 1) ?: 1.0,
            'expenseDate' => $this->dateString($expense->expense_date),
            'expenseType' => $this->stringOrFallback($expense->expense_type ?? null, 'daily'),
            'id' => (string) $expense->id,
        ];
    }

    private function invoiceRow(Invoice $invoice): array
    {
        return [
            'discount' => $this->toFloat($invoice->discount ?? 0),
            'discountInput' => $this->toFloat($invoice->discount_input ?? $invoice->discount ?? 0),
            'exchangeRate' => $this->toFloat($invoice->exchange_rate ?? 1) ?: 1.0,
            'id' => (string) $invoice->id,
            'invoiceDate' => $this->dateString($invoice->invoice_date),
            'netAmount' => $this->toFloat($invoice->net_amount ?? 0),
            'netAmountInput' => $this->toFloat($invoice->net_amount_input ?? $invoice->net_amount ?? 0),
            'patientId' => (string) ($invoice->patient_id ?? ''),
            'payments' => $invoice->payments->map(fn ($payment): array => [
                'amount' => $this->toFloat($payment->amount ?? 0),
                'amountInput' => $this->toFloat($payment->amount_input ?? $payment->amount ?? 0),
                'exchangeRate' => $this->toFloat($payment->exchange_rate ?? 1) ?: 1.0,
                'method' => $this->stringOrFallback($payment->method ?? null, 'cash'),
                'paymentDate' => $this->dateString($payment->payment_date),
            ])->values()->all(),
            'status' => $this->stringOrFallback($invoice->status ?? null, 'pending'),
            'totalAmount' => $this->toFloat($invoice->total_amount ?? 0),
            'totalAmountInput' => $this->toFloat($invoice->total_amount_input ?? $invoice->total_amount ?? 0),
            'visitId' => (string) ($invoice->visit_id ?? ''),
        ];
    }

    private function patientNameMap(Collection $patients): array
    {
        return $patients->mapWithKeys(fn (Patient $patient): array => [
            (string) $patient->id => $this->patientName($patient),
        ])->all();
    }

    private function patientName(Patient $patient): string
    {
        $fullName = trim(sprintf('%s %s', (string) ($patient->first_name ?? ''), (string) ($patient->last_name ?? '')));
        if ($fullName !== '') {
            return $fullName;
        }

        $patientCode = trim((string) ($patient->patient_code ?? ''));

        return $patientCode !== '' ? $patientCode : "Patient #{$patient->id}";
    }

    private function patientRow(Patient $patient): array
    {
        return [
            'createdAt' => $this->dateTimeString($patient->created_at),
            'firstName' => (string) ($patient->first_name ?? ''),
            'id' => (string) $patient->id,
            'lastName' => (string) ($patient->last_name ?? ''),
            'patientCode' => (string) ($patient->patient_code ?? ''),
            'updatedAt' => $this->dateTimeString($patient->updated_at),
        ];
    }

    private function prescriptionRow(mixed $prescription): ?array
    {
        if ($prescription === null) {
            return null;
        }

        return [
            'amount' => (string) ($prescription->dosage_amount ?? ''),
            'content' => (string) ($prescription->content ?? ''),
            'createdAt' => $this->dateTimeString($prescription->created_at ?? null),
            'foodTiming' => (string) ($prescription->food_timing ?? ''),
            'frequency' => (string) ($prescription->frequency ?? ''),
            'id' => (string) ($prescription->id ?? ''),
            'items' => collect($prescription->items ?? [])->map(fn ($item): array => [
                'amount' => (string) ($item->amount ?? ''),
                'createdAt' => $this->dateTimeString($item->created_at ?? null),
                'foodTiming' => (string) ($item->food_timing ?? ''),
                'frequency' => (string) ($item->frequency ?? ''),
                'id' => (string) ($item->id ?? ''),
                'name' => (string) ($item->name ?? ''),
                'prescriptionId' => (string) ($item->prescription_id ?? ''),
                'unit' => (string) ($item->unit ?? ''),
                'updatedAt' => $this->dateTimeString($item->updated_at ?? null),
            ])->values()->all(),
            'name' => (string) ($prescription->medicine_name ?? ''),
            'unit' => (string) ($prescription->dosage_unit ?? ''),
            'updatedAt' => $this->dateTimeString($prescription->updated_at ?? null),
            'visitTreatmentId' => (string) ($prescription->visit_treatment_id ?? ''),
        ];
    }

    private function resolveDateRange(array $filters): array
    {
        return [
            CarbonImmutable::parse((string) $filters['startDate'])->startOfDay(),
            CarbonImmutable::parse((string) $filters['endDate'])->endOfDay(),
        ];
    }

    private function safeTransactionRow(SafeTransaction $safeTransaction): array
    {
        $staff = $safeTransaction->pickedByStaff;
        $staffName = trim((string) ($staff?->full_name ?? ''));

        return [
            'amount' => $this->toFloat($safeTransaction->amount ?? 0),
            'amountInput' => $this->toFloat($safeTransaction->amount_input ?? $safeTransaction->amount ?? 0),
            'direction' => (string) ($safeTransaction->direction ?? ''),
            'entryType' => (string) ($safeTransaction->entry_type ?? ''),
            'exchangeRate' => $this->toFloat($safeTransaction->exchange_rate ?? 1) ?: 1.0,
            'id' => (string) $safeTransaction->id,
            'notes' => (string) ($safeTransaction->notes ?? ''),
            'pickedByStaffId' => (string) ($safeTransaction->picked_by_staff_id ?? ''),
            'pickedByStaffName' => $staffName,
            'transactionDate' => $this->dateString($safeTransaction->transaction_date),
        ];
    }

    private function salaryPaymentRow(SalaryPayment $salaryPayment): array
    {
        $staff = $salaryPayment->staff;
        $staffName = trim((string) ($staff?->full_name ?? ''));

        return [
            'exchangeRate' => $this->toFloat($salaryPayment->exchange_rate ?? 1) ?: 1.0,
            'id' => (string) $salaryPayment->id,
            'netAmount' => $this->toFloat($salaryPayment->net_amount ?? 0),
            'netAmountInput' => $this->toFloat($salaryPayment->net_amount_input ?? $salaryPayment->net_amount ?? 0),
            'paymentDate' => $this->dateString($salaryPayment->payment_date),
            'staffId' => (string) ($salaryPayment->staff_id ?? ''),
            'staffName' => $staffName,
            'status' => $this->stringOrFallback($salaryPayment->status ?? null, 'pending'),
        ];
    }

    private function shareholderRow(Shareholder $shareholder): array
    {
        $contributedAmount = $this->toFloat($shareholder->total_contribution_amount ?? 0);
        $distributedAmount = $this->toFloat($shareholder->total_distribution_amount ?? 0);

        return [
            'balanceAmount' => $this->toFloat($contributedAmount - $distributedAmount),
            'contributedAmount' => $contributedAmount,
            'distributedAmount' => $distributedAmount,
            'fullName' => (string) ($shareholder->full_name ?? ''),
            'id' => (string) $shareholder->id,
            'initialCapitalInput' => $this->toFloat($shareholder->initial_capital_input ?? 0),
            'ownershipPercentage' => $this->toFloat($shareholder->ownership_percentage ?? 0),
            'status' => $this->stringOrFallback($shareholder->status ?? null, 'active'),
        ];
    }

    private function shareholderTransactionRow(ShareholderTransaction $transaction): array
    {
        return [
            'amount' => $this->toFloat($transaction->amount ?? 0),
            'amountInput' => $this->toFloat($transaction->amount_input ?? $transaction->amount ?? 0),
            'id' => (string) $transaction->id,
            'notes' => (string) ($transaction->notes ?? ''),
            'shareholderId' => (string) ($transaction->shareholder_id ?? ''),
            'shareholderName' => (string) ($transaction->shareholder?->full_name ?? ''),
            'transactionDate' => $this->dateString($transaction->transaction_date),
            'transactionType' => (string) ($transaction->transaction_type ?? 'contribution'),
        ];
    }

    private function stringOrFallback(mixed $value, string $fallback): string
    {
        $trimmed = trim((string) ($value ?? ''));

        return $trimmed !== '' ? $trimmed : $fallback;
    }

    private function taskRow(PatientSessionTask $task): array
    {
        return [
            'createdAt' => $this->dateTimeString($task->created_at),
            'id' => (string) $task->id,
            'implantCompanyId' => (string) ($task->implant_company_id ?? ''),
            'notes' => (string) ($task->notes ?? ''),
            'patientId' => (string) ($task->patient_id ?? ''),
            'status' => (string) ($task->status ?? ''),
            'title' => (string) ($task->title ?? ''),
            'updatedAt' => $this->dateTimeString($task->updated_at),
        ];
    }

    private function implantCompanyRow(ImplantCompany $company): array
    {
        return [
            'companyName' => (string) ($company->company_name ?? ''),
            'createdAt' => $this->dateTimeString($company->created_at),
            'id' => (string) $company->id,
            'implantType' => (string) ($company->implant_type ?? ''),
            'note' => (string) ($company->note ?? ''),
            'recordDate' => $this->dateString($company->record_date),
            'updatedAt' => $this->dateTimeString($company->updated_at),
        ];
    }

    private function toFloat(mixed $value): float
    {
        return round((float) ($value ?? 0), 2);
    }

    private function visitRow(Visit $visit): array
    {
        return [
            'createdAt' => $this->dateTimeString($visit->created_at),
            'dentistId' => (string) ($visit->dentist_id ?? ''),
            'dentistName' => $this->dentistName($visit->dentist?->full_name, $visit->dentist_id),
            'id' => (string) $visit->id,
            'patientId' => (string) ($visit->patient_id ?? ''),
            'tag' => (string) ($visit->tag ?? ''),
            'updatedAt' => $this->dateTimeString($visit->updated_at),
            'visitDate' => $this->dateString($visit->visit_date),
        ];
    }

    private function visitTreatmentRow(VisitTreatment $visitTreatment, bool $includePrescription): array
    {
        return [
            'createdAt' => $this->dateTimeString($visitTreatment->created_at),
            'id' => (string) $visitTreatment->id,
            'notes' => (string) ($visitTreatment->notes ?? ''),
            'prescription' => $includePrescription ? $this->prescriptionRow($visitTreatment->prescription) : null,
            'price' => $this->toFloat($visitTreatment->price ?? 0),
            'treatment' => [
                'category' => (string) ($visitTreatment->treatment?->category ?? ''),
                'name' => (string) ($visitTreatment->treatment?->name ?? ''),
            ],
            'treatmentId' => (string) ($visitTreatment->treatment_id ?? ''),
            'updatedAt' => $this->dateTimeString($visitTreatment->updated_at),
            'visit' => [
                'dentistName' => $this->dentistName($visitTreatment->visit?->dentist?->full_name, $visitTreatment->visit?->dentist_id),
                'patientId' => (string) ($visitTreatment->visit?->patient_id ?? ''),
                'tag' => (string) ($visitTreatment->visit?->tag ?? ''),
                'visitDate' => $this->dateString($visitTreatment->visit?->visit_date),
            ],
            'visitId' => (string) ($visitTreatment->visit_id ?? ''),
        ];
    }
}
