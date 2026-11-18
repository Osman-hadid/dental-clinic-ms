<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Domain\Entities\ImplantCompany;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Domain\Entities\PatientSessionTask;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Domain\Services\CurrencyService;
use App\Modules\DentalManagement\Domain\Services\InvoiceService;
use App\Modules\DentalManagement\Domain\Services\PaymentService;
use App\Modules\DentalManagement\Domain\Services\VisitService;
use App\Modules\DentalManagement\Domain\Services\VisitTreatmentService;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\ImplantPlanning\StoreImplantPlanningRequest;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

final class ImplantPlanningController extends BaseApiController
{
    private const IMPLANT_TASK_MARKER = 'implant_tooth';

    public function __construct(
        private readonly VisitService $visitService,
        private readonly VisitTreatmentService $visitTreatmentService,
        private readonly InvoiceService $invoiceService,
        private readonly PaymentService $paymentService,
        private readonly CurrencyService $currencyService,
    ) {}

    public function store(StoreImplantPlanningRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $patientId = (int) $validated['patientId'];
        $patient = Patient::query()->findOrFail($patientId);
        $this->authorize('update', $patient);

        $implantTeeth = array_values(array_unique($validated['implantTeeth']));
        if ($implantTeeth === []) {
            throw new ApiException(
                errorCode: 'IMPLANT_TEETH_REQUIRED',
                message: 'Select at least one implant tooth.',
                httpCode: 422
            );
        }

        $resolvedCurrency = $this->currencyService->normalizeCurrency(
            currency: (string) ($validated['currency'] ?? 'AFN'),
            exchangeRate: isset($validated['exchangeRate']) ? (float) $validated['exchangeRate'] : null,
        );
        $currency = $resolvedCurrency['currency'];
        $exchangeRate = (float) $resolvedCurrency['exchangeRate'];

        $implantPricePerToothInput = round((float) $validated['implantPricePerTooth'], 2);
        if ($implantPricePerToothInput <= 0) {
            throw new ApiException(
                errorCode: 'IMPLANT_PRICE_INVALID',
                message: 'Implant price per tooth must be greater than zero.',
                httpCode: 422
            );
        }

        $implantPricePerTooth = $this->currencyService->toAfn($implantPricePerToothInput, $currency, $exchangeRate);
        $supplierCostPerToothInput = round((float) ($validated['supplierCostPerTooth'] ?? 0), 2);
        $supplierCostPerTooth = $this->currencyService->toAfn($supplierCostPerToothInput, $currency, $exchangeRate);
        $paidNowAmountInput = round((float) ($validated['paidNowAmount'] ?? 0), 2);
        $paidNowAmount = $this->currencyService->toAfn($paidNowAmountInput, $currency, $exchangeRate);
        $recordDate = $this->resolveRecordDate($validated['visitDate'] ?? null);
        $treatmentId = (int) $validated['treatmentId'];

        $totalSelectedImplantsPayment = round($implantPricePerTooth * count($implantTeeth), 2);
        $totalSelectedImplantsPaymentInput = round($implantPricePerToothInput * count($implantTeeth), 2);
        $invoiceNetAmount = $totalSelectedImplantsPayment;

        if ($paidNowAmount - $invoiceNetAmount > 0.01) {
            throw new ApiException(
                errorCode: 'PAID_AMOUNT_EXCEEDS_INVOICE',
                message: 'Paid amount cannot exceed net invoice amount.',
                httpCode: 422
            );
        }

        $paymentMethod = (string) $validated['paymentMethod'];
        $invoiceStatus = $paidNowAmount >= $invoiceNetAmount && $invoiceNetAmount > 0
            ? 'paid'
            : ($paidNowAmount > 0 ? 'partially_paid' : 'unpaid');

        $companyPayload = [
            'id' => isset($validated['implantCompanyId']) ? (int) $validated['implantCompanyId'] : null,
            'name' => trim((string) ($validated['implantCompanyName'] ?? '')),
            'type' => trim((string) ($validated['implantCompanyType'] ?? '')),
            'date' => $validated['implantCompanyDate'] ?? null,
            'note' => trim((string) ($validated['implantCompanyNote'] ?? '')),
        ];

        if ($companyPayload['id'] === null && ($companyPayload['name'] !== '' || $companyPayload['type'] !== '' || $companyPayload['note'] !== '')) {
            if ($companyPayload['name'] === '' || $companyPayload['type'] === '') {
                throw new ApiException(
                    errorCode: 'IMPLANT_COMPANY_REQUIRED',
                    message: 'Company name and implant type are required to save third-party details.',
                    httpCode: 422
                );
            }
        }

        // This flow writes implant-company records directly, so enforce the
        // same permission used by the dedicated implant-company endpoints.
        if ($companyPayload['id'] !== null || $companyPayload['name'] !== '' || $companyPayload['type'] !== '') {
            abort_unless($request->user()?->can('dental-management.implant-companies.create'), 403);
        }

        $this->authorize('create', VisitTreatment::class);
        $this->authorize('create', Invoice::class);
        if ($paidNowAmount > 0) {
            $this->authorize('create', Payment::class);
        }

        $summary = DB::transaction(function () use (
            $validated,
            $patient,
            $patientId,
            $currency,
            $exchangeRate,
            $implantTeeth,
            $implantPricePerTooth,
            $implantPricePerToothInput,
            $supplierCostPerTooth,
            $supplierCostPerToothInput,
            $paidNowAmount,
            $paidNowAmountInput,
            $recordDate,
            $treatmentId,
            $invoiceNetAmount,
            $totalSelectedImplantsPaymentInput,
            $invoiceStatus,
            $paymentMethod,
            $companyPayload
        ): array {
            $userId = $this->authenticatedUserId();
            $visitId = null;
            $createdVisit = false;
            $dentistId = null;

            $linkedVisitId = isset($validated['linkedVisitId']) ? (int) $validated['linkedVisitId'] : null;
            if ($linkedVisitId) {
                $linkedVisit = Visit::query()->findOrFail($linkedVisitId);
                if ((int) $linkedVisit->patient_id !== $patientId) {
                    throw new ApiException(
                        errorCode: 'VISIT_PATIENT_MISMATCH',
                        message: 'Selected visit does not belong to the patient.',
                        httpCode: 422
                    );
                }
                $visitId = (int) $linkedVisit->id;
                $dentistId = (int) $linkedVisit->dentist_id;
            } else {
                $dentistId = isset($validated['dentistId']) ? (int) $validated['dentistId'] : 0;
                if ($dentistId <= 0) {
                    throw new ApiException(
                        errorCode: 'DENTIST_REQUIRED',
                        message: 'A valid dentist is required to create a new implant visit.',
                        httpCode: 422
                    );
                }

                $this->authorize('create', Visit::class);

                $tag = $this->buildVisitTag($patient->patient_code ?? (string) $patientId, $recordDate);
                $diagnosisNotes = $this->buildDiagnosisNotes($validated['notes'] ?? null);

                $visit = $this->visitService->createVisit([
                    'appointment_id' => null,
                    'patient_id' => $patientId,
                    'dentist_id' => $dentistId,
                    'tag' => $tag,
                    'visit_date' => $recordDate,
                    'diagnosis_notes' => $diagnosisNotes,
                    'next_visit_date' => null,
                    'created_by' => $userId,
                    'updated_by' => $userId,
                    'deleted_by' => null,
                ]);

                $visitId = (int) $visit->id;
                $createdVisit = true;
            }

            if (!$visitId || !$dentistId) {
                throw new ApiException(
                    errorCode: 'VISIT_RESOLUTION_FAILED',
                    message: 'Unable to resolve visit or dentist for implant record.',
                    httpCode: 422
                );
            }

            $implantCompanyId = $this->resolveImplantCompanyId($companyPayload, $recordDate, $userId);

            foreach ($implantTeeth as $toothNumber) {
                $treatmentNote = $this->buildTreatmentNote(
                    toothNumber: $toothNumber,
                    implantPricePerTooth: $implantPricePerTooth,
                    implantPricePerToothInput: $implantPricePerToothInput,
                    supplierCostPerTooth: $supplierCostPerTooth,
                    supplierCostPerToothInput: $supplierCostPerToothInput,
                    currency: $currency,
                    exchangeRate: $exchangeRate,
                    diameter: (string) ($validated['implantDiameterMm'] ?? ''),
                    length: (string) ($validated['implantLengthMm'] ?? ''),
                    arch: (string) ($validated['implantArch'] ?? ''),
                    protocol: (string) ($validated['loadingProtocol'] ?? ''),
                    notes: $validated['notes'] ?? null,
                );

                $this->visitTreatmentService->createVisitTreatment([
                    'visit_id' => $visitId,
                    'treatment_id' => $treatmentId,
                    'tooth_id' => null,
                    'tooth_number' => $toothNumber,
                    'dentist_id' => $dentistId,
                    'price' => number_format($implantPricePerTooth, 2, '.', ''),
                    'material' => $this->truncate((string) ($validated['implantSystem'] ?? ''), 255) ?: null,
                    'notes' => $treatmentNote,
                    'material_items' => null,
                    'prescription' => null,
                    'created_by' => $userId,
                    'updated_by' => $userId,
                    'deleted_by' => null,
                ]);
            }

            $invoice = $this->invoiceService->createInvoice([
                'patient_id' => $patientId,
                'visit_id' => $visitId,
                'source_visit_ids' => [$visitId],
                'total_amount' => $totalSelectedImplantsPaymentInput,
                'discount' => 0,
                'net_amount' => $totalSelectedImplantsPaymentInput,
                'currency' => $currency,
                'exchange_rate' => $exchangeRate,
                'invoice_date' => $recordDate,
                'status' => $invoiceStatus,
                'payment_type' => $paymentMethod,
                'notes' => $this->truncate((string) ($validated['notes'] ?? ''), 255) ?: null,
                'created_by' => $userId,
                'updated_by' => $userId,
                'deleted_by' => null,
            ]);

            $paymentId = null;
            if ($paidNowAmount > 0) {
                $payment = $this->paymentService->createPayment([
                    'invoice_id' => $invoice->id,
                    'amount' => $paidNowAmountInput,
                    'currency' => $currency,
                    'exchange_rate' => $exchangeRate,
                    'payment_date' => $recordDate,
                    'method' => $paymentMethod,
                    'notes' => 'Initial payment from implant planning flow.',
                    'created_by' => $userId,
                    'updated_by' => $userId,
                    'deleted_by' => null,
                ]);
                $paymentId = (int) $payment->id;
            }

            $this->syncImplantSessionTasks(
                patientId: $patientId,
                teeth: $implantTeeth,
                supplierCostPerTooth: $supplierCostPerTooth,
                supplierCostPerToothInput: $supplierCostPerToothInput,
                currency: $currency,
                exchangeRate: $exchangeRate,
                implantCompanyId: $implantCompanyId,
                userId: $userId
            );

            $supplierTotalCost = round($supplierCostPerTooth * count($implantTeeth), 2);
            $supplierTotalCostInput = round($supplierCostPerToothInput * count($implantTeeth), 2);
            $remainingDebt = max(0, $invoiceNetAmount - $paidNowAmount);
            $remainingDebtInput = max(0, $totalSelectedImplantsPaymentInput - $paidNowAmountInput);

            return [
                'createdVisit' => $createdVisit,
                'currency' => $currency,
                'exchangeRate' => $exchangeRate,
                'invoiceId' => (int) $invoice->id,
                'paidNowAmount' => $paidNowAmount,
                'paidNowAmountInput' => round(min($totalSelectedImplantsPaymentInput, $paidNowAmountInput), 2),
                'paymentId' => $paymentId,
                'remainingDebt' => round($remainingDebt, 2),
                'remainingDebtInput' => round($remainingDebtInput, 2),
                'savedAt' => CarbonImmutable::now()->toIso8601String(),
                'supplierRemainingAmount' => $supplierTotalCost,
                'supplierRemainingAmountInput' => $supplierTotalCostInput,
                'supplierTotalCost' => $supplierTotalCost,
                'supplierTotalCostInput' => $supplierTotalCostInput,
                'treatmentCount' => count($implantTeeth),
                'visitId' => (int) $visitId,
            ];
        });

        return $this->successResponse(
            data: $summary,
            message: 'Implant planning data saved to patient records and billing.',
            code: 201
        );
    }

    private function resolveImplantCompanyId(array $payload, string $recordDate, ?int $userId): ?int
    {
        $companyId = $payload['id'];
        $companyName = $payload['name'];
        $implantType = $payload['type'];
        $note = $payload['note'];
        $date = $payload['date'] ?: $recordDate;

        if ($companyId) {
            $company = ImplantCompany::query()->find($companyId);
            if (!$company) {
                return null;
            }

            $company->record_date = $date;
            if ($note !== '') {
                $company->note = $note;
            }
            $company->updated_by = $userId;
            $company->save();

            return (int) $company->id;
        }

        if ($companyName === '' || $implantType === '') {
            return null;
        }

        $company = ImplantCompany::query()->firstOrNew([
            'company_name' => $companyName,
            'implant_type' => $implantType,
        ]);

        if (!$company->exists) {
            $company->created_by = $userId;
        }

        $company->record_date = $date;
        if ($note !== '') {
            $company->note = $note;
        }
        $company->updated_by = $userId;
        $company->save();

        return (int) $company->id;
    }

    private function syncImplantSessionTasks(
        int $patientId,
        array $teeth,
        float $supplierCostPerTooth,
        float $supplierCostPerToothInput,
        string $currency,
        float $exchangeRate,
        ?int $implantCompanyId,
        ?int $userId
    ): void {
        $existingTasks = PatientSessionTask::query()
            ->where('patient_id', $patientId)
            ->get(['id', 'notes', 'title', 'implant_company_id']);

        $byTooth = [];
        foreach ($existingTasks as $task) {
            $tooth = $this->extractImplantTooth((string) ($task->notes ?? ''), (string) ($task->title ?? ''));
            if (!$tooth) {
                continue;
            }

            $notes = (string) ($task->notes ?? '');
            if (!str_contains($notes, self::IMPLANT_TASK_MARKER) && stripos((string) ($task->title ?? ''), 'implant tooth') === false) {
                continue;
            }

            $byTooth[$tooth] = $task;
        }

        foreach ($teeth as $toothNumber) {
            $existing = $byTooth[$toothNumber] ?? null;
            if ($existing) {
                $existingNotes = (string) ($existing->notes ?? '');
                $supplierPaid = $this->extractTaggedFloat($existingNotes, 'supplier_paid');
                $supplierPaidInput = $this->extractTaggedFloat($existingNotes, 'supplier_paid_input');
                if ($supplierPaidInput <= 0) {
                    $supplierPaidInput = strtoupper($currency) === 'USD' && $exchangeRate > 0
                        ? round($supplierPaid / $exchangeRate, 2)
                        : round($supplierPaid, 2);
                }

                $existing->forceFill([
                    'implant_company_id' => $implantCompanyId,
                    'notes' => $this->buildImplantTaskNotes(
                        toothNumber: $toothNumber,
                        availability: $this->extractImplantAvailability($existingNotes),
                        supplierPaid: $supplierPaid,
                        supplierTotal: $supplierCostPerTooth,
                        currency: $currency,
                        exchangeRate: $exchangeRate,
                        supplierPaidInput: $supplierPaidInput,
                        supplierTotalInput: $supplierCostPerToothInput,
                    ),
                    'updated_by' => $userId,
                ])->save();

                continue;
            }

            PatientSessionTask::query()->create([
                'patient_id' => $patientId,
                'implant_company_id' => $implantCompanyId,
                'title' => "Implant Tooth {$toothNumber}",
                'mark' => 'red',
                'status' => 'pending',
                'notes' => $this->buildImplantTaskNotes(
                    toothNumber: $toothNumber,
                    availability: 'not_available',
                    supplierPaid: 0,
                    supplierTotal: $supplierCostPerTooth,
                    currency: $currency,
                    exchangeRate: $exchangeRate,
                    supplierPaidInput: 0,
                    supplierTotalInput: $supplierCostPerToothInput,
                ),
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);
        }
    }

    private function buildImplantTaskNotes(
        string $toothNumber,
        string $availability,
        float $supplierPaid,
        float $supplierTotal,
        string $currency,
        float $exchangeRate,
        float $supplierPaidInput,
        float $supplierTotalInput
    ): string {
        return sprintf(
            '[%s:%s] [implant_availability:%s] [currency:%s] [exchangeRate:%.6f] [supplier_paid:%.2f] [supplier_paid_input:%.2f] [supplier_total:%.2f] [supplier_total_input:%.2f]',
            self::IMPLANT_TASK_MARKER,
            $toothNumber,
            $availability,
            strtoupper($currency),
            $exchangeRate,
            $supplierPaid,
            $supplierPaidInput,
            $supplierTotal,
            $supplierTotalInput
        );
    }

    private function buildTreatmentNote(
        string $toothNumber,
        float $implantPricePerTooth,
        float $implantPricePerToothInput,
        float $supplierCostPerTooth,
        float $supplierCostPerToothInput,
        string $currency,
        float $exchangeRate,
        string $diameter,
        string $length,
        string $arch,
        string $protocol,
        ?string $notes
    ): ?string {
        $noteParts = [
            '[condition:implant]',
            "[tooth:{$toothNumber}]",
            '[currency:'.strtoupper($currency).']',
            sprintf('[exchangeRate:%.6f]', $exchangeRate),
            sprintf('[patientPrice:%.2f]', $implantPricePerTooth),
            sprintf('[patientPriceInput:%.2f]', $implantPricePerToothInput),
            sprintf('[supplierCost:%.2f]', $supplierCostPerTooth),
            sprintf('[supplierCostInput:%.2f]', $supplierCostPerToothInput),
            '[diameter:'.($diameter !== '' ? $diameter : '-').']',
            '[length:'.($length !== '' ? $length : '-').']',
            '[arch:'.$arch.']',
            '[protocol:'.$protocol.']',
            trim((string) ($notes ?? '')),
        ];

        $note = trim(implode(' ', array_filter($noteParts, static fn ($value): bool => $value !== '')));
        $note = $this->truncate($note, 255);

        return $note !== '' ? $note : null;
    }

    private function extractImplantAvailability(string $notes): string
    {
        if (preg_match('/\[implant_availability:(not_available|in_purchase|available|done)\]/i', $notes, $match) === 1 && isset($match[1])) {
            return strtolower($match[1]);
        }

        return 'not_available';
    }

    private function extractTaggedFloat(string $notes, string $tag): float
    {
        if (preg_match('/\['.preg_quote($tag, '/').':([0-9]+(?:\.[0-9]+)?)\]/i', $notes, $match) === 1 && isset($match[1])) {
            return round((float) $match[1], 2);
        }

        return 0.0;
    }

    private function extractImplantTooth(string $notes, string $title): ?string
    {
        if (preg_match('/\[implant_tooth:([0-9]{2})\]/i', $notes, $match) === 1 && isset($match[1])) {
            return $match[1];
        }

        if (preg_match('/([0-9]{2})/', $title, $match) === 1 && isset($match[1])) {
            return $match[1];
        }

        return null;
    }

    private function resolveRecordDate(?string $value): string
    {
        $trimmed = trim((string) $value);
        if ($trimmed === '') {
            return CarbonImmutable::now()->toDateString();
        }

        return $trimmed;
    }

    private function buildVisitTag(string $patientCode, string $recordDate): string
    {
        $patientCodeTagPart = preg_replace('/\s+/', '-', trim($patientCode)) ?: $patientCode;
        $tag = "implant-{$patientCodeTagPart}-".str_replace('-', '', $recordDate);

        return $this->truncate($tag, 100);
    }

    private function buildDiagnosisNotes(?string $notes): ?string
    {
        $parts = [];
        $notesValue = trim((string) $notes);
        if ($notesValue !== '') {
            $parts[] = $notesValue;
        }
        $parts[] = '[implant-planning-sheet]';
        $note = $this->truncate(implode(' | ', $parts), 255);

        return $note !== '' ? $note : null;
    }

    private function truncate(string $value, int $maxLength): string
    {
        return mb_strlen($value) > $maxLength ? mb_substr($value, 0, $maxLength) : $value;
    }

    private function authenticatedUserId(): ?int
    {
        $userId = auth()->id();

        return $userId !== null ? (int) $userId : null;
    }
}
