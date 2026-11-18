'use client';

import { JSX, useState } from 'react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utilities';
import { useAuth } from '@/modules/auth/presentation/hooks/useAuth';
import { useUIStore } from '@/modules/common/store/ui-store';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, { message: 'Password is required' }),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const WindowsLoginForm = ({
  className,
  ...props
}: React.ComponentProps<'form'>): JSX.Element => {
  const { isLoggingIn, login, loginError } = useAuth();
  const { isLoading: uiLoading } = useUIStore();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginFormData>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormData): void => {
    login(data);
  };

  const isBusy = isLoggingIn || uiLoading;
  const inputClassName =
    'h-12 rounded-xl border-white/15 bg-white/[0.08] pl-11 pr-4 text-sm text-white shadow-none placeholder:text-white/35 focus-visible:border-pink-200/60 focus-visible:ring-pink-200/25';

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('flex w-full flex-col gap-5', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <label htmlFor="login-email" className="text-xs font-medium text-white/75">Email address</label>
              <FormControl>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@clinic.com"
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    className={inputClassName}
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage className="text-xs text-rose-200" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <label htmlFor="login-password" className="text-xs font-medium text-white/75">Password</label>
              <FormControl>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className={cn(inputClassName, 'pr-12')}
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-200/60"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage className="text-xs text-rose-200" />
            </FormItem>
          )}
        />

        {loginError ? (
          <div role="alert" aria-live="polite" className="rounded-xl border border-rose-200/20 bg-rose-950/35 px-4 py-3 text-sm text-rose-100">
            {loginError.message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isBusy}
          className="group mt-1 flex h-13 w-full items-center justify-center gap-3 rounded-xl border border-white/70 bg-white px-5 text-sm font-semibold text-[#26132f] shadow-[0_8px_24px_rgba(10,3,20,0.18)] transition-colors duration-200 hover:border-white hover:bg-[#fff5fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#190d2a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? 'Signing in…' : 'Sign in'}
          {!isBusy ? (
            <span className="flex size-7 items-center justify-center rounded-full bg-[#26132f]/[0.07]">
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          ) : null}
        </button>
      </form>
    </Form>
  );
};

export default WindowsLoginForm;
