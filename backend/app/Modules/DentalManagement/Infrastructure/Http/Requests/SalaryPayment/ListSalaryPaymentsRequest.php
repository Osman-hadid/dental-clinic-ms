<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\SalaryPayment;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListSalaryPaymentsRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'salary_month',
            'payment_date',
            'net_amount',
            'currency',
            'created_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [
            'staff',
        ];
    }

    protected static function filters(): array
    {
        return [
            AllowedFilter::exact('status', 'status', true),
            AllowedFilter::exact('staffId', 'staff_id', true),
            AllowedFilter::exact('currency', 'currency', true),
            AllowedFilter::trashed(),
        ];
    }

    protected static function searchableColumns(): array
    {
        return [
            'salaryMonth' => 'salary_month',
            'notes' => 'notes',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'staffId' => 'staff_id',
            'salaryMonth' => 'salary_month',
            'paymentDate' => 'payment_date',
            'grossAmount' => 'gross_amount',
            'grossAmountInput' => 'gross_amount_input',
            'bonusAmount' => 'bonus_amount',
            'bonusAmountInput' => 'bonus_amount_input',
            'deductionAmount' => 'deduction_amount',
            'deductionAmountInput' => 'deduction_amount_input',
            'netAmount' => 'net_amount',
            'netAmountInput' => 'net_amount_input',
            'currency' => 'currency',
            'exchangeRate' => 'exchange_rate',
            'status' => 'status',
            'paidFromSafe' => 'paid_from_safe',
            'notes' => 'notes',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}
