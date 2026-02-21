<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Payment;

use App\Modules\Common\Infrastructure\Http\Requests\BulkDeleteRequest;

final class BulkDeletePaymentsRequest extends BulkDeleteRequest
{
    protected function tableName(): string
    {
        return 'payments';
    }

    protected function entityName(): string
    {
        return 'Payment';
    }

    public function authorize(): bool
    {
        return true;
    }
}
