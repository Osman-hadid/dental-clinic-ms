<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Expense;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListExpensesRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'expense_date',
            'amount',
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
            AllowedFilter::exact('expenseType', 'expense_type', true),
            AllowedFilter::exact('category', 'category', true),
            AllowedFilter::exact('staffId', 'staff_id', true),
            AllowedFilter::exact('currency', 'currency', true),
            AllowedFilter::trashed(),
        ];
    }

    protected static function searchableColumns(): array
    {
        return [
            'title' => 'title',
            'notes' => 'notes',
            'vendor' => 'vendor',
            'category' => 'category',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'expenseType' => 'expense_type',
            'title' => 'title',
            'category' => 'category',
            'amount' => 'amount',
            'amountInput' => 'amount_input',
            'currency' => 'currency',
            'exchangeRate' => 'exchange_rate',
            'expenseDate' => 'expense_date',
            'paymentMethod' => 'payment_method',
            'vendor' => 'vendor',
            'quantity' => 'quantity',
            'unitCost' => 'unit_cost',
            'unitCostInput' => 'unit_cost_input',
            'notes' => 'notes',
            'staffId' => 'staff_id',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}
