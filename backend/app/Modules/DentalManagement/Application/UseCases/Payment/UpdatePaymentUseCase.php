<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Payment;

use App\Modules\DentalManagement\Application\DTOs\PaymentData;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Services\PaymentService;

final readonly class UpdatePaymentUseCase
{
    public function __construct(private PaymentService $paymentService) {}

    public function execute(int $id, PaymentData $paymentData): Payment
    {
        return $this->paymentService->updatePayment(id: $id, data: $paymentData->toArray());
    }
}
