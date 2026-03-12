<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;

final class Invoice extends Model
{
    use HasUserStamps;
    use LogsActivity;
    use SoftDeletes;

    protected $fillable = [
        'patient_id',
        'visit_id',
        'source_visit_ids',
        'total_amount',
        'total_amount_input',
        'discount',
        'discount_input',
        'net_amount',
        'net_amount_input',
        'currency',
        'exchange_rate',
        'invoice_date',
        'status',
        'payment_type',
        'notes',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'patient_id' => 'integer',
            'visit_id' => 'integer',
            'source_visit_ids' => 'array',
            'total_amount' => 'decimal:2',
            'total_amount_input' => 'decimal:2',
            'discount' => 'decimal:2',
            'discount_input' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'net_amount_input' => 'decimal:2',
            'exchange_rate' => 'decimal:6',
            'invoice_date' => 'date:Y-m-d',
            'status' => 'string',
            'payment_type' => 'string',
            'created_by' => 'integer',
            'updated_by' => 'integer',
            'deleted_by' => 'integer',
        ];
    }

    public function prunable()
    {
        return self::onlyTrashed()
            ->where('deleted_at', '<', now()->subMonths(6));
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName(class_basename($this))
            ->setDescriptionForEvent(fn (string $eventName): string => "Invoice {$eventName}");
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function hasRelatedRecords(): bool
    {
        return $this->payments()->exists();
    }
}