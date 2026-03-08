<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Requests\Patient\Concerns;

use App\Modules\DentalManagement\Domain\Entities\PatientQuestion;
use Illuminate\Database\Query\Builder;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

trait ValidatesPatientQuestionnaire
{
    protected function patientQuestionnaireRules(): array
    {
        return [
            'questionnaireResponses' => 'nullable|array',
            'questionnaireResponses.*.questionId' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('patient_questions', 'id')->where(
                    static fn (Builder $query): Builder => $query->whereNull('deleted_at')
                ),
            ],
            'questionnaireResponses.*.answer' => 'nullable|string|max:5000',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $activeQuestions = PatientQuestion::query()
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->get(['id', 'question_text', 'answer_type', 'is_required']);

            if ($activeQuestions->isEmpty()) {
                return;
            }

            $responsesByQuestionId = collect($this->input('questionnaireResponses', []))
                ->filter(fn (mixed $response): bool => is_array($response))
                ->mapWithKeys(function (array $response, int $index): array {
                    $questionId = $response['questionId'] ?? null;
                    if (!is_numeric($questionId)) {
                        return [];
                    }

                    return [
                        (int) $questionId => [
                            'answer' => $this->normalizeQuestionnaireAnswer($response['answer'] ?? null),
                            'index' => $index,
                        ],
                    ];
                });

            foreach ($activeQuestions as $question) {
                $response = $responsesByQuestionId->get($question->id);
                $answer = is_array($response) ? ($response['answer'] ?? null) : null;
                $index = is_array($response) ? ($response['index'] ?? null) : null;

                if ($question->is_required && $answer === null) {
                    $validator->errors()->add(
                        'questionnaireResponses',
                        sprintf('Answer is required for "%s".', $question->question_text)
                    );

                    continue;
                }

                if ($answer === null) {
                    continue;
                }

                if (!$this->isQuestionnaireAnswerValid($question, $answer)) {
                    $errorKey = is_int($index) ? "questionnaireResponses.{$index}.answer" : 'questionnaireResponses';
                    $validator->errors()->add($errorKey, $this->questionnaireAnswerValidationMessage($question));
                }
            }
        });
    }

    private function normalizeQuestionnaireAnswer(mixed $answer): ?string
    {
        if ($answer === null) {
            return null;
        }

        if (is_bool($answer)) {
            return $answer ? 'yes' : 'no';
        }

        if (is_scalar($answer)) {
            $normalized = trim((string) $answer);

            return $normalized === '' ? null : $normalized;
        }

        return null;
    }

    private function isQuestionnaireAnswerValid(PatientQuestion $question, string $answer): bool
    {
        return match ($question->answer_type) {
            'number' => is_numeric($answer),
            'yes_no' => in_array(strtolower($answer), ['yes', 'no', 'true', 'false', '1', '0'], true),
            'date' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $answer) === 1
                && \DateTimeImmutable::createFromFormat('Y-m-d', $answer) !== false,
            default => true,
        };
    }

    private function questionnaireAnswerValidationMessage(PatientQuestion $question): string
    {
        return match ($question->answer_type) {
            'number' => sprintf('Answer for "%s" must be a number.', $question->question_text),
            'yes_no' => sprintf('Answer for "%s" must be Yes or No.', $question->question_text),
            'date' => sprintf('Answer for "%s" must be a valid date.', $question->question_text),
            default => sprintf('Answer for "%s" is invalid.', $question->question_text),
        };
    }
}
