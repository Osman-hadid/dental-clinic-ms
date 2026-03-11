'use client';

import { JSX } from 'react';
import Image from 'next/image';
import { AuthRedirect } from '@/modules/auth/presentation/components/auth-redirect';
import WindowsLoginForm from '@/modules/auth/presentation/components/windows-login-form';

// eslint-disable-next-line react/function-component-definition
export default function Page(): JSX.Element {
  return (
    <div className="relative min-h-svh overflow-hidden text-white">
      <Image
        src="/figma/windows-login/bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f0fffb_0%,#b9f6e9_35%,#6fe7d0_60%,#34cbb3_85%,#1bb89d_100%)] mix-blend-color"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-white/10" aria-hidden="true" />

      <div className="relative z-10 min-h-svh">
        <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
          <div className="flex flex-col items-center gap-4 md:gap-6">
            <div className="relative size-24 overflow-hidden rounded-full ring-2 ring-white/40 md:size-40">
              <Image
                src="/logo2.png"
                alt="Sourire logo"
                fill
                sizes="160px"
                className="object-cover"
              />
            </div>
            <h1 className="text-2xl font-semibold tracking-[0.04em] md:text-4xl">
              Welcome back
            </h1>
            <AuthRedirect />
            <WindowsLoginForm className="mt-2" />
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 text-white/90 md:bottom-10">
          <Image
            src="/logo.png"
            alt="Sourire logo"
            width={100}
            height={100}
            className="size-8 md:size-20"
          />
          <span className="text-lg font-semibold tracking-[0.02em] md:text-2xl">Sourire</span>
        </div>
      </div>
    </div>
  );
}
