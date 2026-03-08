<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\DTOs;

final readonly class PatientQuestionData
{
    public function __construct(
        public string $questionText,
        public string $answerType = 'text',
        public ?string $helpText = null,
        public int $sortOrder = 0,
        public bool $isRequired = false,
        public bool $isActive = true,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            questionText: (string) ($data['questionText'] ?? ''),
            answerType: (string) ($data['answerType'] ?? 'text'),
            helpText: $data['helpText'] ?? null,
            sortOrder: (int) ($data['sortOrder'] ?? 0),
            isRequired: (bool) ($data['isRequired'] ?? false),
            isActive: (bool) ($data['isActive'] ?? true),
        );
    }

    public function toArray(): array
    {
        return [
            'question_text' => $this->questionText,
            'answer_type' => $this->answerType,
            'help_text' => $this->helpText,
            'sort_order' => $this->sortOrder,
            'is_required' => $this->isRequired,
            'is_active' => $this->isActive,
        ];
    }
}
