<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\DentalManagement\Domain\Entities\Debt;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

final readonly class DebtSettlementService
{
    public function __construct(
        private InvoiceService $invoiceService,
        private PaymentService $paymentService,
        private DebtService $debtService,
    ) {}

    public function settleDebt(int $debtId, array $data): array
    {
        return DB::transaction(function () use ($debtId, $data): array {
            $debt = Debt::query()
                ->lockForUpdate()
                ->find($debtId);

            if ($debt === null) {
                throw new ApiException(
                    errorCode: 'DEBT_NOT_FOUND',
                    message: 'Debt record not found.',
                    httpCode: 404,
                );
            }

            if ((string) $debt->status !== 'open') {
                throw new ApiException(
                    errorCode: 'DEBT_ALREADY_SETTLED',
                    message: 'This debt is already settled.',
                    details: [
                        'debtId' => $debt->id,
                        'status' => $debt->status,
                        'outstandingAmount' => round((float) $debt->debt_amount, 2),
                    ],
                    httpCode: 422,
                );
            }

            $sourceInvoice = Invoice::query()
                ->lockForUpdate()
                ->find((int) $debt->invoice_id);

            if ($sourceInvoice === null) {
                throw new ApiException(
                    errorCode: 'SOURCE_INVOICE_NOT_FOUND',
                    message: 'Source invoice not found for this debt.',
                    httpCode: 404,
                );
            }

            if ((string) $sourceInvoice->status === 'cancelled') {
                throw new ApiException(
                    errorCode: 'SOURCE_INVOICE_CANCELLED',
                    message: 'Cannot settle debt for a cancelled invoice.',
                    httpCode: 422,
                );
            }

            $paymentDate = (string) ($data['paymentDate'] ?? $data['payment_date'] ?? now()->format('Y-m-d'));
            $requestedAmountInput = round((float) ($data['amount'] ?? 0), 2);
            $method = strtolower((string) ($data['method'] ?? 'cash'));
            $note = trim((string) ($data['notes'] ?? ''));
            $userId = Auth::id();
            $sourceCurrency = $this->currencyCode((string) ($sourceInvoice->currency ?? 'AFN'));
            $sourceExchangeRate = $this->exchangeRate((float) ($sourceInvoice->exchange_rate ?? 1));
            $sourceNetInput = round((float) ($sourceInvoice->net_amount_input ?? $sourceInvoice->net_amount ?? 0), 2);
            $sourceDiscountInput = round((float) ($sourceInvoice->discount_input ?? $sourceInvoice->discount ?? 0), 2);
            $sourceTotalInput = round((float) ($sourceInvoice->total_amount_input ?? ($sourceInvoice->net_amount ?? 0) + ($sourceInvoice->discount ?? 0)), 2);

            $alreadyPaid = round((float) Payment::query()
                ->where('invoice_id', $sourceInvoice->id)
                ->sum('amount'), 2);
            $sourceNet = round((float) ($sourceInvoice->net_amount ?? 0), 2);
            $outstandingAmount = max(0, round($sourceNet - $alreadyPaid, 2));
            $outstandingAmountInput = $this->toInputAmount($outstandingAmount, $sourceCurrency, $sourceExchangeRate);

            if ($outstandingAmount <= 0.01) {
                throw new ApiException(
                    errorCode: 'DEBT_ALREADY_SETTLED',
                    message: 'This debt has no outstanding amount.',
                    details: [
                        'debtId' => $debt->id,
                        'outstandingAmount' => $outstandingAmount,
                        'outstandingAmountInput' => $outstandingAmountInput,
                        'currency' => $sourceCurrency,
                    ],
                    httpCode: 422,
                );
            }

            if ($requestedAmountInput <= 0) {
                throw new ApiException(
                    errorCode: 'INVALID_SETTLEMENT_AMOUNT',
                    message: 'Settlement amount must be greater than zero.',
                    details: [
                        'currency' => $sourceCurrency,
                        'requestedAmount' => $requestedAmountInput,
                    ],
                    httpCode: 422,
                );
            }

            if ($requestedAmountInput - $outstandingAmountInput > 0.01) {
                throw new ApiException(
                    errorCode: 'SETTLEMENT_AMOUNT_EXCEEDS_OUTSTANDING',
                    message: 'Settlement amount cannot be greater than the outstanding amount.',
                    details: [
                        'currency' => $sourceCurrency,
                        'debtId' => $debt->id,
                        'outstandingAmount' => $outstandingAmount,
                        'outstandingAmountInput' => $outstandingAmountInput,
                        'requestedAmount' => $requestedAmountInput,
                    ],
                    httpCode: 422,
                );
            }

            $requestedAmount = $this->toBaseAmount($requestedAmountInput, $sourceCurrency, $sourceExchangeRate);
            $remainingAmount = max(0, round($outstandingAmount - $requestedAmount, 2));
            $remainingAmountInput = $this->toInputAmount($remainingAmount, $sourceCurrency, $sourceExchangeRate);

            $sourceInvoice = $this->invoiceService->updateInvoice($sourceInvoice->id, [
                'patient_id' => $sourceInvoice->patient_id,
                'visit_id' => $sourceInvoice->visit_id,
                'source_visit_ids' => $this->normalizeSourceVisitIds($sourceInvoice),
                'total_amount' => $sourceTotalInput,
                'discount' => $sourceDiscountInput,
                'net_amount' => $sourceNetInput,
                'currency' => $sourceCurrency,
                'exchange_rate' => $sourceExchangeRate,
                'invoice_date' => $sourceInvoice->invoice_date?->format('Y-m-d') ?? now()->format('Y-m-d'),
                'status' => $remainingAmount <= 0.01 ? 'paid' : 'partially_paid',
                'payment_type' => $sourceInvoice->payment_type ?: 'cash',
                'notes' => $this->buildSourceInvoiceNote(
                    currency: $sourceCurrency,
                    sourceInvoiceId: (int) $sourceInvoice->id,
                    paymentDate: $paymentDate,
                    settledAmount: $requestedAmountInput,
                    remainingAmount: $remainingAmountInput,
                    customNote: $note,
                    existingNote: (string) ($sourceInvoice->notes ?? ''),
                ),
                'updated_by' => $userId,
            ]);

            $settlementInvoice = $this->invoiceService->createInvoice([
                'patient_id' => $sourceInvoice->patient_id,
                'visit_id' => $sourceInvoice->visit_id,
                'source_visit_ids' => $this->normalizeSourceVisitIds($sourceInvoice),
                'total_amount' => $requestedAmountInput,
                'discount' => 0,
                'net_amount' => $requestedAmountInput,
                'currency' => $sourceCurrency,
                'exchange_rate' => $sourceExchangeRate,
                'invoice_date' => $paymentDate,
                'status' => 'paid',
                'payment_type' => $method,
                'notes' => $this->buildSettlementInvoiceNote(
                    currency: $sourceCurrency,
                    sourceInvoiceId: (int) $sourceInvoice->id,
                    settledAmount: $requestedAmountInput,
                    remainingAmount: $remainingAmountInput,
                    customNote: $note,
                ),
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $payment = $this->paymentService->createPayment([
                'invoice_id' => $sourceInvoice->id,
                'payment_date' => $paymentDate,
                'amount' => $requestedAmountInput,
                'currency' => $sourceCurrency,
                'exchange_rate' => $sourceExchangeRate,
                'method' => $method,
                'notes' => $this->buildPaymentNote(
                    currency: $sourceCurrency,
                    sourceInvoiceId: (int) $sourceInvoice->id,
                    settlementInvoiceId: (int) $settlementInvoice->id,
                    settledAmount: $requestedAmountInput,
                    remainingAmount: $remainingAmountInput,
                    customNote: $note,
                ),
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $this->debtService->syncByInvoiceId((int) $sourceInvoice->id);
            $this->debtService->deleteByInvoiceId((int) $settlementInvoice->id);

            return [
                'sourceInvoice' => $sourceInvoice,
                'settlementInvoice' => $settlementInvoice,
                'payment' => $payment,
            ];
        });
    }

    private function normalizeSourceVisitIds(Invoice $invoice): array
    {
        $sourceVisitIds = \is_array($invoice->source_visit_ids) ? $invoice->source_visit_ids : [];
        if ($sourceVisitIds === [] && (int) $invoice->visit_id > 0) {
            $sourceVisitIds = [(int) $invoice->visit_id];
        }

        $normalized = array_values(array_unique(array_map(static fn ($value): int => (int) $value, $sourceVisitIds)));

        return array_slice(array_filter($normalized, static fn (int $id): bool => $id > 0), 0, 1);
    }

    private function buildSourceInvoiceNote(
        string $currency,
        int $sourceInvoiceId,
        string $paymentDate,
        float $settledAmount,
        float $remainingAmount,
        string $customNote,
        string $existingNote,
    ): string {
        $segments = [];
        if ($existingNote !== '') {
            $segments[] = $existingNote;
        }

        $segments[] = "Debt payment recorded from invoice #{$sourceInvoiceId} on {$paymentDate} for {$settledAmount} {$currency}. Remaining debt: {$remainingAmount} {$currency}.";

        if ($customNote !== '') {
            $segments[] = $customNote;
        }

        return trim(implode(' | ', $segments));
    }

    private function buildSettlementInvoiceNote(string $currency, int $sourceInvoiceId, float $settledAmount, float $remainingAmount, string $customNote): string
    {
        $base = "Settlement invoice generated from invoice #{$sourceInvoiceId} for {$settledAmount} {$currency}. Remaining debt after payment: {$remainingAmount} {$currency}.";
        if ($customNote === '') {
            return $base;
        }

        return "{$base} {$customNote}";
    }

    private function buildPaymentNote(string $currency, int $sourceInvoiceId, int $settlementInvoiceId, float $settledAmount, float $remainingAmount, string $customNote): string
    {
        $base = "Debt payment of {$settledAmount} {$currency} settled from invoice #{$sourceInvoiceId} using settlement invoice #{$settlementInvoiceId}. Remaining debt: {$remainingAmount} {$currency}.";
        if ($customNote === '') {
            return $base;
        }

        return "{$base} {$customNote}";
    }

    private function currencyCode(string $currency): string
    {
        return strtoupper(trim($currency)) === 'USD' ? 'USD' : 'AFN';
    }

    private function exchangeRate(float $exchangeRate): float
    {
        $normalized = round($exchangeRate, 6);

        return $normalized > 0 ? $normalized : 1.0;
    }

    private function toBaseAmount(float $amountInput, string $currency, float $exchangeRate): float
    {
        if ($this->currencyCode($currency) === 'USD') {
            return round($amountInput * $this->exchangeRate($exchangeRate), 2);
        }

        return round($amountInput, 2);
    }

    private function toInputAmount(float $amount, string $currency, float $exchangeRate): float
    {
        if ($this->currencyCode($currency) === 'USD') {
            return round($amount / $this->exchangeRate($exchangeRate), 2);
        }

        return round($amount, 2);
    }
}
