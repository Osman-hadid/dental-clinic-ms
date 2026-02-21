<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Invoice;

use App\Modules\DentalManagement\Domain\Services\InvoiceService;

final readonly class BulkDeleteInvoicesUseCase
{
    public function __construct(private InvoiceService $invoiceService) {}

    public function execute(array $ids): array
    {
        return $this->invoiceService->bulkDeleteInvoices($ids);
    }
}
