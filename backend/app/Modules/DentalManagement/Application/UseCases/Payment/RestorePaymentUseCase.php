<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Payment;

use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Services\PaymentService;

final readonly class RestorePaymentUseCase
{
    public function __construct(private PaymentService $paymentService) {}

    public function execute(int $id): Payment
    {
        return $this->paymentService->restorePayment($id);
    }
}
