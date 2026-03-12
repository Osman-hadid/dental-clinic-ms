<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;

final class PatientQuestionAnswer extends Model
{
    use HasUserStamps;
    protected $fillable = [
        'patient_id',
        'patient_question_id',
        'answer',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(PatientQuestion::class, 'patient_question_id');
    }
}