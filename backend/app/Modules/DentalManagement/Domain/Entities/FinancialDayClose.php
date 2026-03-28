<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class FinancialDayClose extends Model
{
    protected $fillable = [
        'closing_date',
        'expected_balance',
        'counted_balance',
        'discrepancy_amount',
        'payment_total',
        'cash_payment_total',
        'non_cash_payment_total',
        'safe_in_total',
        'safe_out_total',
        'open_debt_total',
        'open_debt_count',
        'overdue_debt_count',
        'notes',
        'closed_by',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'closing_date' => 'date:Y-m-d',
            'expected_balance' => 'decimal:2',
            'counted_balance' => 'decimal:2',
            'discrepancy_amount' => 'decimal:2',
            'payment_total' => 'decimal:2',
            'cash_payment_total' => 'decimal:2',
            'non_cash_payment_total' => 'decimal:2',
            'safe_in_total' => 'decimal:2',
            'safe_out_total' => 'decimal:2',
            'open_debt_total' => 'decimal:2',
            'open_debt_count' => 'integer',
            'overdue_debt_count' => 'integer',
            'closed_by' => 'integer',
            'closed_at' => 'datetime',
        ];
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }
}
