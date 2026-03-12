<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;

final class ShareholderTransaction extends Model
{
    use HasUserStamps;
    use LogsActivity;
    use SoftDeletes;

    protected $fillable = [
        'shareholder_id',
        'transaction_date',
        'transaction_type',
        'amount',
        'amount_input',
        'currency',
        'exchange_rate',
        'safe_transaction_id',
        'notes',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'shareholder_id' => 'integer',
            'transaction_date' => 'date:Y-m-d',
            'amount' => 'decimal:2',
            'amount_input' => 'decimal:2',
            'exchange_rate' => 'decimal:6',
            'safe_transaction_id' => 'integer',
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
            ->setDescriptionForEvent(fn (string $eventName): string => "ShareholderTransaction {$eventName}");
    }

    public function shareholder(): BelongsTo
    {
        return $this->belongsTo(Shareholder::class);
    }

    public function safeTransaction(): BelongsTo
    {
        return $this->belongsTo(SafeTransaction::class);
    }
}