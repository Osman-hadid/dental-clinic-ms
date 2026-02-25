<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\Exceptions\ApiException;
use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Repositories\InvoiceRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

final readonly class InvoiceService
{
    public function __construct(private InvoiceRepositoryInterface $invoiceRepository) {}

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
        return tap(
            $this->invoiceRepository->restore($id),
            fn () => $this->invoiceRepository->invalidateCache()
        );
    }

    public function createInvoice(array $data): Invoice
    {
        return DB::transaction(function () use ($data): Invoice {
            $normalized = $this->normalizeAmounts($data);
            $this->assertInvoiceAmounts($normalized);

            $invoice = $this->invoiceRepository->create(data: $normalized);
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
            $this->invoiceRepository->invalidateCache();

            return $invoice;
        });
    }

    public function deleteInvoice(int $id): void
    {
        $this->invoiceRepository->delete(id: $id);
        $this->invoiceRepository->invalidateCache();
    }

    public function forceDeleteInvoice(int $id): void
    {
        $permission = $this->invoiceRepository->findTrashed($id) ?? $this->invoiceRepository->find($id);
        $this->invoiceRepository->forceDelete($permission->id);
        $this->invoiceRepository->invalidateCache();
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
        $data['total_amount'] = round((float) ($data['total_amount'] ?? 0), 2);
        $data['discount'] = round((float) ($data['discount'] ?? 0), 2);
        $data['net_amount'] = round((float) ($data['net_amount'] ?? 0), 2);

        return $data;
    }

}
