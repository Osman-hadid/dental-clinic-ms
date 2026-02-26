<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

final class Expense extends Model
{
    use LogsActivity;
    use SoftDeletes;

    protected $fillable = [
        'expense_type',
        'title',
        'category',
        'amount',
        'amount_input',
        'currency',
        'exchange_rate',
        'expense_date',
        'payment_method',
        'vendor',
        'quantity',
        'unit_cost',
        'unit_cost_input',
        'notes',
        'source_id',
        'source_type',
        'staff_id',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'amount_input' => 'decimal:2',
            'exchange_rate' => 'decimal:6',
            'expense_date' => 'date:Y-m-d',
            'quantity' => 'integer',
            'source_id' => 'integer',
            'staff_id' => 'integer',
            'unit_cost' => 'decimal:2',
            'unit_cost_input' => 'decimal:2',
            'created_by' => 'integer',
            'updated_by' => 'integer',
            'deleted_by' => 'integer',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName(class_basename($this))
            ->setDescriptionForEvent(fn (string $eventName): string => "Expense {$eventName}");
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }
}
