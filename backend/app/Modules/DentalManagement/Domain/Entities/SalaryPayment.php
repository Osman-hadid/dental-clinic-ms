<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;

final class SalaryPayment extends Model
{
    use HasUserStamps;
    use LogsActivity;
    use SoftDeletes;

    protected $fillable = [
        'staff_id',
        'salary_month',
        'payment_date',
        'gross_amount',
        'gross_amount_input',
        'bonus_amount',
        'bonus_amount_input',
        'deduction_amount',
        'deduction_amount_input',
        'net_amount',
        'net_amount_input',
        'currency',
        'exchange_rate',
        'status',
        'paid_from_safe',
        'notes',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'staff_id' => 'integer',
            'payment_date' => 'date:Y-m-d',
            'gross_amount' => 'decimal:2',
            'gross_amount_input' => 'decimal:2',
            'bonus_amount' => 'decimal:2',
            'bonus_amount_input' => 'decimal:2',
            'deduction_amount' => 'decimal:2',
            'deduction_amount_input' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'net_amount_input' => 'decimal:2',
            'exchange_rate' => 'decimal:6',
            'paid_from_safe' => 'boolean',
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
            ->setDescriptionForEvent(fn (string $eventName): string => "SalaryPayment {$eventName}");
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }
}