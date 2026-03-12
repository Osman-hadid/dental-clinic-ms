'use client';

import { JSX, type MouseEvent } from 'react';
import Image from 'next/image';
import { AuthRedirect } from '@/modules/auth/presentation/components/auth-redirect';
import WindowsLoginForm from '@/modules/auth/presentation/components/windows-login-form';

// eslint-disable-next-line react/function-component-definition
export default function Page(): JSX.Element {
  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const xPct = 50 + (x - 0.5) * 24;
    const yPct = 10 + (y - 0.5) * 18;

    event.currentTarget.style.setProperty('--x', `${xPct}%`);
    event.currentTarget.style.setProperty('--y', `${yPct}%`);
    event.currentTarget.style.setProperty('--mx', x.toFixed(3));
    event.currentTarget.style.setProperty('--my', y.toFixed(3));
  };

  const handleMouseLeave = (event: MouseEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty('--x', '50%');
    event.currentTarget.style.setProperty('--y', '10%');
    event.currentTarget.style.setProperty('--mx', '0.5');
    event.currentTarget.style.setProperty('--my', '0.5');
  };

  return (
    <div
      className="login-root relative min-h-svh overflow-hidden text-white"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="bg-image" aria-hidden="true">
        <Image
          src="/figma/windows-login/bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div
        className="absolute inset-0 animate-hue-shift mix-blend-color"
        style={{
          background: 'radial-gradient(circle at var(--x, 50%) var(--y, 10%), hsl(var(--hue, 160), 70%, 90%) 0%, hsl(var(--hue, 160), 70%, 85%) 35%, hsl(var(--hue, 160), 70%, 80%) 60%, hsl(var(--hue, 160), 70%, 75%) 85%, hsl(var(--hue, 160), 70%, 70%) 100%)',
          '--hue': '160'
        } as any}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-white/10" aria-hidden="true" />

      <div className="relative z-10 min-h-svh">
        <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
          <div className="flex flex-col items-center gap-4 md:gap-6">
            <div className="relative size-24 overflow-hidden rounded-full ring-2 ring-white/40 md:size-40 animate-fade-in-up [animation-delay:200ms]">
              <Image
                src="/logo2.png"
                alt="Sourire logo"
                fill
                sizes="160px"
                className="object-cover"
              />
            </div>
            <h1 className="text-2xl font-semibold tracking-[0.04em] md:text-4xl animate-fade-in-up [animation-delay:400ms]">
              Welcome back
            </h1>
            <div className="animate-fade-in-up [animation-delay:600ms]">
              <AuthRedirect />
            </div>
            <WindowsLoginForm className="mt-2 animate-fade-in-up [animation-delay:800ms]" />
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 text-white/90 md:bottom-10 animate-fade-in-up [animation-delay:1000ms]">
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

      <style jsx>{`
        .login-root {
          --x: 50%;
          --y: 10%;
          --mx: 0.5;
          --my: 0.5;
        }

        .bg-image {
          position: absolute;
          inset: -3%;
          transform: translate(calc((var(--mx, 0.5) - 0.5) * 24px), calc((var(--my, 0.5) - 0.5) * 24px))
            scale(1.03);
          transition: transform 160ms ease-out;
          will-change: transform;
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @property --hue {
          syntax: '<number>';
          inherits: true;
          initial-value: 160;
        }

        @keyframes hue-shift {
          0% {
            --hue: 160;
          }
          50% {
            --hue: 210;
          }
          100% {
            --hue: 360;
          }
        }

        .animate-hue-shift {
          animation: hue-shift 10s ease-in-out infinite alternate;
          will-change: background;
        }
      `}</style>
    </div>
  );
}
