'use client';

import { JSX } from 'react';
import Image from 'next/image';
import { AuthRedirect } from '@/modules/auth/presentation/components/auth-redirect';
import LoginForm from '@/modules/auth/presentation/components/login-form';

// eslint-disable-next-line react/function-component-definition
export default function Page(): JSX.Element {
  return (
    <div className="min-h-svh bg-background p-3 md:p-6">
      <div className="mx-auto flex min-h-[calc(100svh-1.5rem)] w-full max-w-[1450px] overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[0_30px_80px_-45px_rgba(15,23,42,0.24)]">
        <section className="relative flex w-full flex-col px-6 py-6 md:px-10 lg:w-[56%] lg:px-14">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="overflow-hidden h-16 w-16 md:h-60 md:w-60">
                <Image
                  src="/logo2.png"
                  alt="Clinic logo"
                  width={160}
                  height={160}
                  sizes="160px"
                  quality={100}
                  className="h-70 w-70 object-contain"
                />
              </div>
            </div>
          </div>

          <div className="relative flex flex-1 items-center">
            <div className="w-full max-w-[520px]">
              <AuthRedirect />
              <LoginForm />
            </div>
          </div>

          <div className="pointer-events-none absolute -right-30 top-[-60px] hidden h-[240px] w-[240px] rounded-full border border-dashed border-primary/30 lg:block" />
          <div className="pointer-events-none absolute -right-35 bottom-[-140px] hidden h-[420px] w-[420px] rounded-full border border-dashed border-primary/25 lg:block" />
        </section>

        <section className="relative hidden overflow-hidden lg:block lg:w-[44%]">
          <Image
            src="/back.jpg"
            fill
            priority
            alt="Login visual"
            sizes="(max-width: 1024px) 0px, 44vw"
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-0 left-0 top-0 w-[35%] bg-card [clip-path:ellipse(95%_85%_at_0%_50%)]" />
        </section>
      </div>
    </div>
  );
}
