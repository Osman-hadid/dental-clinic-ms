<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Invoice;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Services\InvoiceService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ListInvoicesUseCase
{
    public function __construct(private InvoiceService $invoiceService) {}

    public function execute(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->invoiceService->listInvoices($querySpecification);
    }
}
