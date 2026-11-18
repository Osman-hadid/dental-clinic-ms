'use client';

import { JSX, type CSSProperties, type MouseEvent } from 'react';
import Image from 'next/image';
import { ArrowUpRight, Sparkles } from 'lucide-react';
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
    <main
      className="login-root relative min-h-svh overflow-hidden text-white"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Keep the existing background image and its animated color wash. */}
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
          background:
            'radial-gradient(circle at var(--x, 50%) var(--y, 10%), hsl(var(--hue, 160), 70%, 90%) 0%, hsl(var(--hue, 160), 70%, 85%) 35%, hsl(var(--hue, 160), 70%, 80%) 60%, hsl(var(--hue, 160), 70%, 75%) 85%, hsl(var(--hue, 160), 70%, 70%) 100%)',
          '--hue': '160',
        } as CSSProperties}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-white/10" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-[1440px] flex-col px-6 py-6 sm:px-10 sm:py-8 lg:px-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative size-10 overflow-hidden rounded-xl border border-white/25 bg-white/10 shadow-lg backdrop-blur-md">
              <Image src="/logo2.png" alt="" fill sizes="40px" className="object-cover" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Sourire</span>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/20 bg-black/10 px-4 py-2 text-xs font-medium text-white/75 backdrop-blur-md sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]" />
            Dental care workspace
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(390px,470px)] lg:gap-20 lg:py-16">
          <section className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 shadow-lg backdrop-blur-md">
              <Sparkles className="size-3.5 text-pink-200" />
              Care, connected
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.045em] drop-shadow-lg sm:text-5xl lg:text-6xl">
              Welcome back,
              <span className="mt-1 block bg-gradient-to-r from-white via-pink-100 to-fuchsia-200 bg-clip-text text-transparent">
                doctor.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-md text-sm leading-7 text-white/75 sm:text-base lg:mx-0">
              Your clinic, your team, and every patient detail—right where you need them.
            </p>
            <div className="mx-auto mt-9 flex max-w-md items-center gap-4 rounded-2xl border border-white/15 bg-black/10 p-4 text-left shadow-xl backdrop-blur-md lg:mx-0">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-pink-100 ring-1 ring-white/15">
                <ArrowUpRight className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">A brighter day at the clinic</p>
                <p className="mt-1 text-xs leading-5 text-white/60">
                  Pick up right where your care team left off.
                </p>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-[470px]">
            <div className="rounded-[30px] border border-white/25 bg-[#190d2a]/55 p-6 shadow-[0_30px_100px_rgba(8,0,20,0.4)] backdrop-blur-2xl sm:p-9">
              <div className="mb-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-200/80">Your workspace</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">Sign in to Sourire</h2>
                <p className="mt-2 text-sm text-white/60">Enter your account details to continue.</p>
              </div>
              <AuthRedirect />
              <WindowsLoginForm />
              <div className="mt-7 flex items-center justify-center gap-2 border-t border-white/10 pt-5 text-xs text-white/50">
                <span className="size-1.5 rounded-full bg-emerald-300/90" />
                Your workspace is private and secure
              </div>
            </div>
            <p className="mt-5 text-center text-xs text-white/45">Need help? Contact your clinic administrator.</p>
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-white/15 pt-5 text-[11px] text-white/50">
          <span>© {new Date().getFullYear()} Sourire</span>
          <span className="hidden sm:block">A more connected way to care</span>
        </footer>
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

        @property --hue {
          syntax: '<number>';
          inherits: true;
          initial-value: 160;
        }

        @keyframes hue-shift {
          0% { --hue: 160; }
          50% { --hue: 210; }
          100% { --hue: 360; }
        }

        .animate-hue-shift {
          animation: hue-shift 10s ease-in-out infinite alternate;
          will-change: background;
        }

        @media (prefers-reduced-motion: reduce) {
          .bg-image { transition: none; }
          .animate-hue-shift { animation: none; }
        }
      `}</style>
    </main>
  );
}
