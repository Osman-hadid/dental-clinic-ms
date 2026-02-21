<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Invoice;

use App\Modules\DentalManagement\Application\DTOs\InvoiceData;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Services\InvoiceService;

final readonly class CreateInvoiceUseCase
{
    public function __construct(
        private InvoiceService $invoiceService
    ) {}

    public function execute(InvoiceData $invoiceData): Invoice
    {
        return $this->invoiceService->createInvoice(data: $invoiceData->toArray());
    }
}
