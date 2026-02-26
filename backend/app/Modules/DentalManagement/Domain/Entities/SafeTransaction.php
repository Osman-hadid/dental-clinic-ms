<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

final class SafeTransaction extends Model
{
    use LogsActivity;
    use SoftDeletes;

    protected $fillable = [
        'transaction_date',
        'entry_type',
        'direction',
        'amount',
        'amount_input',
        'currency',
        'exchange_rate',
        'source_id',
        'source_type',
        'picked_by_staff_id',
        'notes',
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
            'transaction_date' => 'date:Y-m-d',
            'source_id' => 'integer',
            'picked_by_staff_id' => 'integer',
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
            ->setDescriptionForEvent(fn (string $eventName): string => "SafeTransaction {$eventName}");
    }

    public function pickedByStaff(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'picked_by_staff_id');
    }

    public static function currentBalance(?int $excludingId = null): float
    {
        $query = self::query();

        if ($excludingId !== null) {
            $query->where('id', '!=', $excludingId);
        }

        $sumIn = (float) (clone $query)->where('direction', 'in')->sum('amount');
        $sumOut = (float) (clone $query)->where('direction', 'out')->sum('amount');

        return round($sumIn - $sumOut, 2);
    }
}
