<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

final class Debt extends Model
{
    use LogsActivity;

    protected $fillable = [
        'invoice_id',
        'patient_id',
        'invoice_date',
        'net_amount',
        'paid_amount',
        'debt_amount',
        'status',
        'currency',
    ];

    protected function casts(): array
    {
        return [
            'invoice_id' => 'integer',
            'patient_id' => 'integer',
            'invoice_date' => 'date:Y-m-d',
            'net_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'debt_amount' => 'decimal:2',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([
                'invoice_id',
                'patient_id',
                'invoice_date',
                'net_amount',
                'paid_amount',
                'debt_amount',
                'status',
                'currency',
            ])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName(class_basename($this))
            ->setDescriptionForEvent(fn (string $eventName): string => "Debt {$eventName}");
    }
}
