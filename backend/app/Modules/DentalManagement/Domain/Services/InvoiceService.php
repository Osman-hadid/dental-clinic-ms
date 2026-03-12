<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Repositories\InvoiceRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

final readonly class InvoiceService
{
    public function __construct(
        private InvoiceRepositoryInterface $invoiceRepository,
        private CurrencyService $currencyService,
        private DebtService $debtService,
    ) {}

    public function listInvoices(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->invoiceRepository->paginate($querySpecification);
    }

    public function getInvoice(int $id): Invoice
    {
        return $this->invoiceRepository->find(id: $id);
    }

    public function restoreInvoice(int $id): Invoice
    {
        return DB::transaction(function () use ($id): Invoice {
            $invoice = $this->invoiceRepository->restore($id);
            $this->syncSafeTransactionForInvoice($invoice);
            $this->debtService->syncForInvoice($invoice);
            $this->invoiceRepository->invalidateCache();

            return $invoice;
        });
    }

    public function createInvoice(array $data): Invoice
    {
        return DB::transaction(function () use ($data): Invoice {
            $normalized = $this->normalizeAmounts($data);
            $this->assertInvoiceAmounts($normalized);

            $invoice = $this->invoiceRepository->create(data: $normalized);
            $this->syncSafeTransactionForInvoice($invoice);
            $this->debtService->syncForInvoice($invoice);
            $this->invoiceRepository->invalidateCache();

            return $invoice;
        });
    }

    public function updateInvoice(int $id, array $data): Invoice
    {
        return DB::transaction(function () use ($id, $data): Invoice {
            $normalized = $this->normalizeAmounts($data);
            $this->assertInvoiceAmounts($normalized, $id);

            $invoice = $this->invoiceRepository->update(id: $id, data: $normalized);
            $this->syncSafeTransactionForInvoice($invoice);
            $this->debtService->syncForInvoice($invoice);
            $this->invoiceRepository->invalidateCache();

            return $invoice;
        });
    }

    public function deleteInvoice(int $id): void
    {
        DB::transaction(function () use ($id): void {
            $this->invoiceRepository->delete(id: $id);
            SafeTransaction::query()
                ->where('source_type', 'invoice')
                ->where('source_id', $id)
                ->delete();
            $this->debtService->deleteByInvoiceId($id);
            $this->invoiceRepository->invalidateCache();
        });
    }

    public function forceDeleteInvoice(int $id): void
    {
        DB::transaction(function () use ($id): void {
            $permission = $this->invoiceRepository->findTrashed($id) ?? $this->invoiceRepository->find($id);
            $this->invoiceRepository->forceDelete($permission->id);
            SafeTransaction::withTrashed()
                ->where('source_type', 'invoice')
                ->where('source_id', $permission->id)
                ->forceDelete();
            $this->debtService->deleteByInvoiceId($permission->id);
            $this->invoiceRepository->invalidateCache();
        });
    }

    public function bulkDeleteInvoices(array $ids): array
    {
        $deleted = [];
        $skipped = [];

        foreach ($ids as $id) {
            $invoice = $this->invoiceRepository->find($id);

            if (method_exists($invoice, 'hasRelatedRecords') && $invoice->hasRelatedRecords()) {
                $skipped[] = $id;

                continue;
            }

            $this->invoiceRepository->delete(id: $id);
            SafeTransaction::query()
                ->where('source_type', 'invoice')
                ->where('source_id', $id)
                ->delete();
            $this->debtService->deleteByInvoiceId((int) $id);
            $deleted[] = $id;
        }

        $this->invoiceRepository->invalidateCache();

        return ['deleted' => $deleted, 'skipped' => $skipped];
    }

    private function assertInvoiceAmounts(array $data, ?int $invoiceId = null): void
    {
        $total = (float) ($data['total_amount'] ?? 0);
        $discount = (float) ($data['discount'] ?? 0);
        $net = (float) ($data['net_amount'] ?? 0);
        $expectedNet = round($total - $discount, 2);

        if ($total < 0 || $discount < 0 || $net < 0) {
            throw new ApiException(
                errorCode: 'INVALID_INVOICE_AMOUNTS',
                message: 'Invoice amounts cannot be negative.',
                httpCode: 422,
            );
        }

        if ($discount - $total > 0.01) {
            throw new ApiException(
                errorCode: 'INVOICE_DISCOUNT_EXCEEDS_TOTAL',
                message: 'Discount cannot be greater than total amount.',
                details: [
                    'discount' => $discount,
                    'totalAmount' => $total,
                ],
                httpCode: 422,
            );
        }

        if ($net - $expectedNet > 0.01) {
            throw new ApiException(
                errorCode: 'INVOICE_NET_EXCEEDS_PAYABLE',
                message: 'Net amount cannot be greater than total amount minus discount.',
                details: [
                    'discount' => $discount,
                    'maxNetAmount' => $expectedNet,
                    'netAmount' => $net,
                    'totalAmount' => $total,
                ],
                httpCode: 422,
            );
        }

        if ($invoiceId === null) {
            return;
        }

        $totalPaid = (float) Payment::query()
            ->where('invoice_id', $invoiceId)
            ->sum('amount');

        if ($totalPaid - $net > 0.01) {
            throw new ApiException(
                errorCode: 'INVOICE_NET_BELOW_PAID',
                message: 'Net amount cannot be less than the total amount already paid.',
                details: [
                    'netAmount' => $net,
                    'totalPaid' => $totalPaid,
                ],
                httpCode: 422,
            );
        }
    }

    private function normalizeAmounts(array $data): array
    {
        $resolvedCurrency = $this->currencyService->normalizeCurrency(
            currency: (string) ($data['currency'] ?? 'AFN'),
            exchangeRate: isset($data['exchange_rate']) ? (float) $data['exchange_rate'] : null,
        );

        $totalInput = round((float) ($data['total_amount'] ?? 0), 2);
        $discountInput = round((float) ($data['discount'] ?? 0), 2);
        $netInput = round((float) ($data['net_amount'] ?? 0), 2);

        $data['currency'] = $resolvedCurrency['currency'];
        $data['exchange_rate'] = $resolvedCurrency['exchangeRate'];
        $data['total_amount_input'] = $totalInput;
        $data['discount_input'] = $discountInput;
        $data['net_amount_input'] = $netInput;
        $data['total_amount'] = $this->currencyService->toUsd($totalInput, $data['currency'], (float) $data['exchange_rate']);
        $data['discount'] = $this->currencyService->toUsd($discountInput, $data['currency'], (float) $data['exchange_rate']);
        $data['net_amount'] = $this->currencyService->toUsd($netInput, $data['currency'], (float) $data['exchange_rate']);

        return $data;
    }

    private function syncSafeTransactionForInvoice(Invoice $invoice): void
    {
        $entry = SafeTransaction::withTrashed()
            ->firstOrNew([
                'source_type' => 'invoice',
                'source_id' => $invoice->id,
            ]);

        if ($this->isDebtSettlementInvoice($invoice)) {
            if ($entry->exists) {
                $entry->delete();
            }
            return;
        }

        $hasPayments = Payment::query()
            ->where('invoice_id', $invoice->id)
            ->exists();

        if ((string) $invoice->status !== 'paid' || $hasPayments) {
            if ($entry->exists) {
                $entry->delete();
            }
            return;
        }

        $entry->fill([
            'transaction_date' => $invoice->invoice_date,
            'entry_type' => 'income',
            'direction' => 'in',
            'amount' => round((float) $invoice->net_amount, 2),
            'amount_input' => round((float) ($invoice->net_amount_input ?? $invoice->net_amount), 2),
            'currency' => strtoupper((string) ($invoice->currency ?? 'AFN')),
            'exchange_rate' => round((float) ($invoice->exchange_rate ?? 1), 6),
            'notes' => "Paid invoice #{$invoice->id}",
            'picked_by_staff_id' => null,
        ]);
        $entry->deleted_at = null;
        $entry->save();
    }

    private function isDebtSettlementInvoice(Invoice $invoice): bool
    {
        $notes = mb_strtolower((string) ($invoice->notes ?? ''));

        return str_contains($notes, 'settlement invoice generated from invoice #');
    }

}
