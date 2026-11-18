import { JSX } from 'react';

type ReportPageIntroProps = {
  description: string;
  eyebrow?: string;
  title: string;
};

export const ReportPageIntro = ({ description, eyebrow = 'REPORTS', title }: ReportPageIntroProps): JSX.Element => {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/50 px-5 py-5 shadow-sm sm:px-6 sm:py-6">
      <div className="absolute -right-12 -top-16 size-48 rounded-full bg-primary/5 blur-2xl" aria-hidden="true" />
      <div className="relative max-w-3xl space-y-2">
        <p className="text-xs font-semibold tracking-[0.18em] text-primary">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </section>
  );
};
