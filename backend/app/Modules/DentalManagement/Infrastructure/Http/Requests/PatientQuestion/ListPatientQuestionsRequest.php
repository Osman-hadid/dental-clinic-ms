<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\PatientQuestion;

use App\Modules\Common\Infrastructure\Http\Requests\BaseListRequest;
use Spatie\QueryBuilder\AllowedFilter;

final class ListPatientQuestionsRequest extends BaseListRequest
{
    protected static function sortableColumns(): array
    {
        return [
            'id',
            'question_text',
            'sort_order',
            'created_at',
            'updated_at',
        ];
    }

    protected static function allowedRelations(): array
    {
        return [];
    }

    protected static function filters(): array
    {
        return [
            AllowedFilter::exact('answerType', 'answer_type'),
            AllowedFilter::exact('isRequired', 'is_required', true),
            AllowedFilter::exact('isActive', 'is_active', true),
        ];
    }

    protected static function searchableColumns(): array
    {
        return [
            'questionText' => 'question_text',
            'helpText' => 'help_text',
        ];
    }

    protected static function fieldableColumns(): array
    {
        return [
            'id' => 'id',
            'questionText' => 'question_text',
            'answerType' => 'answer_type',
            'helpText' => 'help_text',
            'sortOrder' => 'sort_order',
            'isRequired' => 'is_required',
            'isActive' => 'is_active',
            'createdAt' => 'created_at',
            'updatedAt' => 'updated_at',
            'deletedAt' => 'deleted_at',
        ];
    }
}
