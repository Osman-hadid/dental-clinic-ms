<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class PatientQuestionAnswer extends Model
{
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
