<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Payment;

use App\Modules\DentalManagement\Domain\Services\PaymentService;

final readonly class BulkDeletePaymentsUseCase
{
    public function __construct(private PaymentService $paymentService) {}

    public function execute(array $ids): array
    {
        return $this->paymentService->bulkDeletePayments($ids);
    }
}
