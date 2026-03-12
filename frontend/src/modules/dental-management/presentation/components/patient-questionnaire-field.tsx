'use client';

import { JSX, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type PatientQuestionAnswer } from '@/modules/dental-management/domain/entities/PatientQuestion';
import { usePatientQuestionList } from '@/modules/dental-management/presentation/hooks/patient-questions/usePatientQuestionList';
import { useFormContext } from 'react-hook-form';

type Props = {
  value: PatientQuestionAnswer[] | undefined;
  onChange: (value: PatientQuestionAnswer[]) => void;
};

const responseSignature = (responses: PatientQuestionAnswer[]): string =>
  JSON.stringify(
    responses.map((response) => ({
      answer: typeof response.answer === 'string' ? response.answer : '',
      questionId: String(response.questionId),
    }))
  );

export const PatientQuestionnaireField = ({ onChange, value }: Props): JSX.Element | null => {
  const t = useTranslations('patient');
  const { formState } = useFormContext();
  const { entities: questions, isFetching } = usePatientQuestionList(1, 100, '', [], [], {
    // Temporarily remove isActive filter to see all questions
    // isActive: ['1'],
  });

  // Debug: Log the fetched questions
  console.log('PatientQuestionnaireField - Fetched questions:', questions);
  console.log('PatientQuestionnaireField - Is fetching:', isFetching);

  const normalizedValue = useMemo(() => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((response) => ({
      answer: typeof response.answer === 'string' ? response.answer : '',
      questionId: String(response.questionId),
    }));
  }, [value]);

  const preparedResponses = useMemo(() => {
    const responseByQuestionId = new Map(
      normalizedValue.map((response) => [String(response.questionId), response.answer ?? ''])
    );

    return questions.map((question) => ({
      answer: responseByQuestionId.get(String(question.id)) ?? '',
      questionId: String(question.id),
    }));
  }, [normalizedValue, questions]);

  useEffect(() => {
    if (isFetching) {
      return;
    }

    if (questions.length === 0) {
      if (normalizedValue.length > 0) {
        onChange([]);
      }

      return;
    }

    if (responseSignature(normalizedValue) === responseSignature(preparedResponses)) {
      return;
    }

    onChange(preparedResponses);
  }, [isFetching, normalizedValue, onChange, preparedResponses, questions.length]);

  const rawQuestionnaireErrors = formState.errors.questionnaireResponses;
  const topLevelError =
    rawQuestionnaireErrors &&
    !Array.isArray(rawQuestionnaireErrors) &&
    'message' in rawQuestionnaireErrors
      ? String(rawQuestionnaireErrors.message ?? '')
      : '';

  if (isFetching) {
    return (
      <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
        <p className="text-sm font-medium">{t('config.form.questionnaireResponses.label')}</p>
        <p className="text-sm text-muted-foreground">
          {t('config.form.questionnaireResponses.loading')}
        </p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="space-y-2 rounded-xl border border-dashed bg-muted/10 p-4">
        <p className="text-sm font-medium">{t('config.form.questionnaireResponses.label')}</p>
        <p className="text-sm text-muted-foreground">
          {t('config.form.questionnaireResponses.empty')}
        </p>
      </div>
    );
  }

  const handleAnswerChange = (questionId: string, answer: string): void => {
    onChange(
      preparedResponses.map((response) =>
        String(response.questionId) === questionId ? { ...response, answer } : response
      )
    );
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-background p-4">
      <div>
        <p className="text-sm font-semibold">{t('config.form.questionnaireResponses.label')}</p>
        <p className="text-xs text-muted-foreground">
          {t('config.form.questionnaireResponses.description')}
        </p>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => {
          const answerValue = preparedResponses[index]?.answer ?? '';
          const rowError = Array.isArray(rawQuestionnaireErrors)
            ? String(rawQuestionnaireErrors[index]?.answer?.message ?? '')
            : '';

          return (
            <div key={question.id} className="space-y-2 rounded-xl border bg-muted/10 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{question.questionText}</p>
                {question.isRequired ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                    {t('config.form.questionnaireResponses.required')}
                  </span>
                ) : null}
              </div>

              {question.helpText ? (
                <p className="text-xs text-muted-foreground">{question.helpText}</p>
              ) : null}

              {question.answerType === 'textarea' ? (
                <textarea
                  value={answerValue}
                  onChange={(event) => {
                    handleAnswerChange(String(question.id), event.target.value);
                  }}
                  rows={4}
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder={t('config.form.questionnaireResponses.textareaPlaceholder')}
                />
              ) : null}

              {question.answerType === 'yes_no' ? (
                <Select
                  onValueChange={(nextValue) => {
                    handleAnswerChange(String(question.id), nextValue);
                  }}
                  value={answerValue}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t('config.form.questionnaireResponses.selectPlaceholder')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">
                      {t('config.form.questionnaireResponses.options.yes')}
                    </SelectItem>
                    <SelectItem value="no">
                      {t('config.form.questionnaireResponses.options.no')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : null}

              {question.answerType === 'text' ||
              question.answerType === 'number' ||
              question.answerType === 'date' ? (
                <Input
                  type={
                    question.answerType === 'number'
                      ? 'number'
                      : question.answerType === 'date'
                        ? 'date'
                        : 'text'
                  }
                  value={answerValue}
                  onChange={(event) => {
                    handleAnswerChange(String(question.id), event.target.value);
                  }}
                  placeholder={t('config.form.questionnaireResponses.answerPlaceholder')}
                />
              ) : null}

              {rowError ? <p className="text-sm text-red-500">{rowError}</p> : null}
            </div>
          );
        })}
      </div>

      {topLevelError ? <p className="text-sm text-red-500">{topLevelError}</p> : null}
    </div>
  );
};
