'use client';

import { JSX } from 'react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utilities';
import { useAuth } from '@/modules/auth/presentation/hooks/useAuth';
import { useUIStore } from '@/modules/common/store/ui-store';
import { zodResolver } from '@hookform/resolvers/zod';
import { LockKeyhole, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, { message: 'Password is required' }),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginForm = ({ className, ...props }: React.ComponentProps<'form'>): JSX.Element => {
  const { isLoggingIn, login, loginError } = useAuth();
  const { isLoading: uiLoading } = useUIStore();
  const form = useForm<LoginFormData>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormData): void => {
    login(data);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('flex w-full max-w-[460px] flex-col gap-6', className)}
        {...props}
      >
        <div className="space-y-3">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Welcome
            <span className="text-primary">.</span>
          </h1>
        </div>
        <div className="grid gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[11px] font-medium text-muted-foreground uppercase">
                  Email
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground/80" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      className="h-12 rounded-2xl border border-primary/20 bg-white/85 pr-11 shadow-none focus-visible:ring-primary/35"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[11px] font-medium text-muted-foreground uppercase">
                  Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground/80" />
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      className="h-12 rounded-2xl border border-primary/20 bg-white/85 pr-11 shadow-none focus-visible:ring-primary/35"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {loginError ? <div className="text-sm text-red-500">{loginError.message}</div> : null}

          <div className="grid gap-3 pt-1">
            <Button
              type="submit"
              disabled={isLoggingIn || uiLoading}
              className="h-12 rounded-2xl bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {isLoggingIn || uiLoading ? 'Logging in...' : 'Login'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default LoginForm;
