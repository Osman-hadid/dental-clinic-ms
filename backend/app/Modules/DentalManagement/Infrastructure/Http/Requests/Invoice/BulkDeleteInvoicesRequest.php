<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Invoice;

use App\Modules\Common\Infrastructure\Http\Requests\BulkDeleteRequest;

final class BulkDeleteInvoicesRequest extends BulkDeleteRequest
{
    protected function tableName(): string
    {
        return 'invoices';
    }

    protected function entityName(): string
    {
        return 'Invoice';
    }

    public function authorize(): bool
    {
        return true;
    }
}
