import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Input } from '../../components/shared/Input';
import { Button } from '../../components/shared/Button';
import { signUp } from '../../services/auth.service';

const schema = z.object({
  firstName:       z.string().min(1, 'First name is required'),
  lastName:        z.string().min(1, 'Last name is required'),
  email:           z.string().email('Enter a valid email'),
  password:        z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
});
type FormValues = z.infer<typeof schema>;

export function SignUpPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: ({ confirmPassword: _, ...rest }: FormValues) => signUp(rest),
    onSuccess: () => navigate('/login?registered=1'),
    onError: () => setError('root', { message: 'Could not create account. Email may already be in use.' }),
  });

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-[28px] font-bold text-white tracking-tight">
            Finance<span className="text-gold-500">OS</span>
          </h1>
          <p className="text-navy-200 text-[14px] mt-1">Enterprise Financial Platform</p>
        </div>

        <div className="bg-surface-0 rounded-card2 p-8 shadow-modal">
          <h2 className="text-[20px] font-semibold text-ink-900 mb-1">Create account</h2>
          <p className="text-[13px] text-ink-600 mb-6">Start your FinanceOS workspace</p>

          <form className="space-y-4" onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" required error={errors.firstName?.message} {...register('firstName')} />
              <Input label="Last name"  required error={errors.lastName?.message}  {...register('lastName')} />
            </div>
            <Input label="Email address" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
            <Input label="Password" type="password" autoComplete="new-password" required hint="Minimum 8 characters" error={errors.password?.message} {...register('password')} />
            <Input label="Confirm password" type="password" autoComplete="new-password" required error={errors.confirmPassword?.message} {...register('confirmPassword')} />

            {errors.root && (
              <div className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">
                {errors.root.message}
              </div>
            )}

            <Button type="submit" className="w-full mt-2" isLoading={mutation.isPending} variant="gold" size="lg">
              Create account
            </Button>
          </form>

          <p className="mt-5 text-center text-[13px] text-ink-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-info hover:text-blue-700 transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
