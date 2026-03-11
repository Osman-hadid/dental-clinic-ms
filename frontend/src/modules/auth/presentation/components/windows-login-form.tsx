'use client';

import { JSX, useState } from 'react';
import Image from 'next/image';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utilities';
import { useAuth } from '@/modules/auth/presentation/hooks/useAuth';
import { useUIStore } from '@/modules/common/store/ui-store';
import { zodResolver } from '@hookform/resolvers/zod';
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
  const glassPill =
    'backdrop-blur-[27px] bg-white/20 border border-white/40 shadow-[0_7px_35px_rgba(0,0,0,0.18)]';
  const glassHover =
    'transition-all duration-200 hover:bg-white/30 hover:border-white/60 hover:shadow-[0_12px_40px_rgba(0,0,0,0.22)]';

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('flex w-full flex-col items-center gap-4', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="w-full max-w-[640px]">
              <FormControl>
                <div className={cn(glassPill, glassHover, 'rounded-full px-6 py-3')}>
                  <Input
                    type="email"
                    placeholder="Email"
                    className="glass-input h-10 border-0 bg-transparent px-0 text-base text-white placeholder:text-white/70 shadow-none focus-visible:border-0 focus-visible:ring-0 md:h-12 md:text-lg"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage className="text-xs text-rose-200/90 md:text-sm" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="w-full max-w-[720px]">
              <FormControl>
                <div className="flex w-full items-center justify-center gap-4 md:gap-5">
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className={cn(
                      glassPill,
                      'flex size-12 items-center justify-center rounded-full md:size-16'
                    )}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Image
                      src="/figma/windows-login/eye-closed.svg"
                      alt=""
                      width={20}
                      height={20}
                      className="md:size-6"
                    />
                  </button>

                  <div className={cn(glassPill, glassHover, 'flex-1 rounded-full px-6 py-3 md:px-8')}>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      className="glass-input h-10 border-0 bg-transparent px-0 text-base text-white placeholder:text-white/70 shadow-none focus-visible:border-0 focus-visible:ring-0 md:h-12 md:text-lg"
                      {...field}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isBusy}
                    className={cn(
                      glassPill,
                      'flex size-12 items-center justify-center rounded-full transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 md:size-16'
                    )}
                    aria-label="Login"
                  >
                    <Image
                      src="/figma/windows-login/arrow-circle.svg"
                      alt=""
                      width={22}
                      height={22}
                      className="md:size-7"
                    />
                  </button>
                </div>
              </FormControl>
              <FormMessage className="text-xs text-rose-200/90 md:text-sm" />
            </FormItem>
          )}
        />

        {loginError ? (
          <div className="text-xs text-rose-200/90 md:text-sm">{loginError.message}</div>
        ) : null}

      </form>
    </Form>
  );
};

export default WindowsLoginForm;
