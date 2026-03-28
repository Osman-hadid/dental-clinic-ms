<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

final class VisitTreatmentImage extends Model
{
    use HasUserStamps;
    use LogsActivity;
    use SoftDeletes;

    protected $fillable = [
        'visit_treatment_id',
        'path',
        'original_name',
        'mime_type',
        'size',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'visit_treatment_id' => 'integer',
            'size' => 'integer',
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
            ->setDescriptionForEvent(fn (string $eventName): string => "VisitTreatmentImage {$eventName}");
    }

    public function visitTreatment(): BelongsTo
    {
        return $this->belongsTo(VisitTreatment::class);
    }
}
