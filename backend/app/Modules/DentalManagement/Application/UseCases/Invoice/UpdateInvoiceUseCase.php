<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Invoice;

use App\Modules\DentalManagement\Application\DTOs\InvoiceData;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Services\InvoiceService;

final readonly class UpdateInvoiceUseCase
{
    public function __construct(private InvoiceService $invoiceService) {}

    public function execute(int $id, InvoiceData $invoiceData): Invoice
    {
        return $this->invoiceService->updateInvoice(id: $id, data: $invoiceData->toArray());
    }
}
