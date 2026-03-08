'use client';

import { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { patientQuestionConfig } from '@/modules/dental-management/presentation/config/patient-question-config';
import {
  useCreatePatientQuestion,
  useDeletePatientQuestion,
  usePatientQuestionList,
  useUpdatePatientQuestion,
} from '@/modules/dental-management/presentation/hooks';

// eslint-disable-next-line react/function-component-definition
export default function PatientQuestionsPage(): JSX.Element {
  const t = useTranslations('patientQuestion');
  const tSidebar = useTranslations('sidebar.dentalManagement');

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'patientQuestions', isCurrent: true, label: t(patientQuestionConfig.title) },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
            <div className="rounded-2xl border bg-gradient-to-r from-background to-muted/30 p-4">
              <h2 className="text-base font-semibold">Patient Intake Questions</h2>
              <p className="text-xs text-muted-foreground">
                Maintain the question bank used during patient registration. Active questions appear
                automatically in the patient form.
              </p>
            </div>
            <EntityList
              config={patientQuestionConfig}
              fetchHook={usePatientQuestionList}
              useCreate={useCreatePatientQuestion}
              useUpdate={useUpdatePatientQuestion}
              useDelete={useDeletePatientQuestion}
            />
          </div>
        </div>
      </div>
    </>
  );
}
