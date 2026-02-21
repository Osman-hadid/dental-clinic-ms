<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Payment;

use App\Modules\DentalManagement\Domain\Services\PaymentService;

final readonly class DeletePaymentUseCase
{
    public function __construct(private PaymentService $paymentService) {}

    public function execute(int $id): void
    {
        $this->paymentService->deletePayment(id: $id);
    }
}
