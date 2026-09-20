import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Input } from '../../components/shared/Input';
import { Button } from '../../components/shared/Button';
import { useAuth } from '../../store/auth.context';
import { login } from '../../services/auth.service';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (tokens) => {
      authLogin({ userId: '', email: '', firstName: '', lastName: '' }, tokens);
      navigate('/onboarding');
    },
    onError: () => setError('root', { message: 'Invalid email or password' }),
  });

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-[28px] font-bold text-white tracking-tight">
            Finance<span className="text-gold-500">OS</span>
          </h1>
          <p className="text-navy-200 text-[14px] mt-1">Enterprise Financial Platform</p>
        </div>

        {/* Card */}
        <div className="bg-surface-0 rounded-card2 p-8 shadow-modal">
          <h2 className="text-[20px] font-semibold text-ink-900 mb-1">Sign in</h2>
          <p className="text-[13px] text-ink-600 mb-6">Enter your credentials to continue</p>

          <form className="space-y-4" onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
            <Input
              label="Email address" type="email" autoComplete="email" required
              error={errors.email?.message} {...register('email')}
            />
            <Input
              label="Password" type="password" autoComplete="current-password" required
              error={errors.password?.message} {...register('password')}
            />

            {errors.root && (
              <div className="text-[12px] text-danger bg-danger-bg border border-danger-border rounded-input px-3 py-2" role="alert">
                {errors.root.message}
              </div>
            )}

            <Button type="submit" className="w-full mt-2" isLoading={mutation.isPending} variant="gold" size="lg">
              Sign in
            </Button>
          </form>

          <p className="mt-5 text-center text-[13px] text-ink-600">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-medium text-info hover:text-blue-700 transition-colors">
              Create one
            </Link>
          </p>
        </div>

        <p className="text-center text-[12px] text-navy-200 mt-6">
          © {new Date().getFullYear()} FinanceOS · All rights reserved
        </p>
      </div>
    </div>
  );
}
