<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Payment;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Services\PaymentService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ListPaymentsUseCase
{
    public function __construct(private PaymentService $paymentService) {}

    public function execute(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->paymentService->listPayments($querySpecification);
    }
}
