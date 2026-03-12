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

final class Appointment extends Model
{
    use HasUserStamps;
    use LogsActivity;
    use SoftDeletes;

    protected $fillable = [
        'patient_id',
        'dentist_id',
        'tag',
        'appointment_date',
        'start_time',
        'end_time',
        'status',
        'notes',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'patient_id' => 'integer',
            'dentist_id' => 'integer',
            'appointment_date' => 'date:Y-m-d',
            'status' => 'string',
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
            ->setDescriptionForEvent(fn (string $eventName): string => "Appointment {$eventName}");
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function dentist(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'dentist_id');
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class);
    }

    public function hasRelatedRecords(): bool
    {
        return $this->visits()->exists();
    }
}