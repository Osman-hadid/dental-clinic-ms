<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Invoice;

use App\Modules\DentalManagement\Domain\Services\InvoiceService;

final readonly class ForceDeleteInvoiceUseCase
{
    public function __construct(private InvoiceService $invoiceService) {}

    public function execute(int $id): void
    {
        $this->invoiceService->forceDeleteInvoice($id);
    }
}
