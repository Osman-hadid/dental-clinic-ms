<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Repositories\InvoiceRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

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
        return tap(
            $this->invoiceRepository->create(data: $data),
            fn () => $this->invoiceRepository->invalidateCache()
        );
    }

    public function updateInvoice(int $id, array $data): Invoice
    {
        return tap(
            $this->invoiceRepository->update(id: $id, data: $data),
            fn () => $this->invoiceRepository->invalidateCache()
        );
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
}
