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
            $method = strtolower((string) ($data['method'] ?? 'cash'));
            $note = trim((string) ($data['notes'] ?? ''));
            $userId = Auth::id();

            $alreadyPaid = round((float) Payment::query()
                ->where('invoice_id', $sourceInvoice->id)
                ->select(DB::raw('COALESCE(SUM(COALESCE(amount_input, amount)), 0) as total_paid'))
                ->value('total_paid'), 2);
            $sourceNet = round((float) ($sourceInvoice->net_amount_input ?? $sourceInvoice->net_amount ?? 0), 2);
            $outstandingAmount = max(0, round($sourceNet - $alreadyPaid, 2));

            if ($outstandingAmount <= 0.01) {
                throw new ApiException(
                    errorCode: 'DEBT_ALREADY_SETTLED',
                    message: 'This debt has no outstanding amount.',
                    details: [
                        'debtId' => $debt->id,
                        'outstandingAmount' => $outstandingAmount,
                    ],
                    httpCode: 422,
                );
            }

            $sourceDiscount = round((float) ($sourceInvoice->discount_input ?? $sourceInvoice->discount ?? 0), 2);
            $sourceTotal = round($alreadyPaid + $sourceDiscount, 2);

            $sourceInvoice = $this->invoiceService->updateInvoice($sourceInvoice->id, [
                'patient_id' => $sourceInvoice->patient_id,
                'visit_id' => $sourceInvoice->visit_id,
                'source_visit_ids' => $this->normalizeSourceVisitIds($sourceInvoice),
                'total_amount' => $sourceTotal,
                'discount' => $sourceDiscount,
                'net_amount' => $alreadyPaid,
                'currency' => 'AFN',
                'exchange_rate' => 1,
                'invoice_date' => $sourceInvoice->invoice_date?->format('Y-m-d') ?? now()->format('Y-m-d'),
                'status' => 'paid',
                'payment_type' => $sourceInvoice->payment_type ?: 'cash',
                'notes' => $this->buildSourceInvoiceNote(
                    sourceInvoiceId: (int) $sourceInvoice->id,
                    paymentDate: $paymentDate,
                    customNote: $note,
                    existingNote: (string) ($sourceInvoice->notes ?? ''),
                ),
                'updated_by' => $userId,
            ]);

            $settlementInvoice = $this->invoiceService->createInvoice([
                'patient_id' => $sourceInvoice->patient_id,
                'visit_id' => $sourceInvoice->visit_id,
                'source_visit_ids' => $this->normalizeSourceVisitIds($sourceInvoice),
                'total_amount' => $outstandingAmount,
                'discount' => 0,
                'net_amount' => $outstandingAmount,
                'currency' => 'AFN',
                'exchange_rate' => 1,
                'invoice_date' => $paymentDate,
                'status' => 'unpaid',
                'payment_type' => $method,
                'notes' => $this->buildSettlementInvoiceNote(
                    sourceInvoiceId: (int) $sourceInvoice->id,
                    customNote: $note,
                ),
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $payment = $this->paymentService->createPayment([
                'invoice_id' => $settlementInvoice->id,
                'payment_date' => $paymentDate,
                'amount' => $outstandingAmount,
                'currency' => 'AFN',
                'exchange_rate' => 1,
                'method' => $method,
                'notes' => $this->buildPaymentNote(
                    sourceInvoiceId: (int) $sourceInvoice->id,
                    settlementInvoiceId: (int) $settlementInvoice->id,
                    customNote: $note,
                ),
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

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
        int $sourceInvoiceId,
        string $paymentDate,
        string $customNote,
        string $existingNote,
    ): string {
        $segments = [];
        if ($existingNote !== '') {
            $segments[] = $existingNote;
        }

        $segments[] = "Debt moved to a settlement flow from invoice #{$sourceInvoiceId} on {$paymentDate}.";

        if ($customNote !== '') {
            $segments[] = $customNote;
        }

        return trim(implode(' | ', $segments));
    }

    private function buildSettlementInvoiceNote(int $sourceInvoiceId, string $customNote): string
    {
        $base = "Settlement invoice generated from invoice #{$sourceInvoiceId}.";
        if ($customNote === '') {
            return $base;
        }

        return "{$base} {$customNote}";
    }

    private function buildPaymentNote(int $sourceInvoiceId, int $settlementInvoiceId, string $customNote): string
    {
        $base = "Debt settled from invoice #{$sourceInvoiceId} using settlement invoice #{$settlementInvoiceId}.";
        if ($customNote === '') {
            return $base;
        }

        return "{$base} {$customNote}";
    }
}
