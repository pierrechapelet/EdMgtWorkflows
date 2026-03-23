'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import type { TokenPair, MfaChallengeResponse } from '@edmgt/shared-types';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const mfaSchema = z.object({
  code: z.string().length(6, 'Enter the 6-digit code from your authenticator app'),
});

type LoginForm = z.infer<typeof loginSchema>;
type MfaForm = z.infer<typeof mfaSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const mfaForm = useForm<MfaForm>({
    resolver: zodResolver(mfaSchema),
  });

  async function onLogin(data: LoginForm) {
    setError(null);
    try {
      const result = await apiClient.post<TokenPair | MfaChallengeResponse>(
        '/auth/login',
        data,
      );

      if ('mfaRequired' in result.data.data) {
        setMfaToken(result.data.data.mfaToken);
      } else {
        storeTokens(result.data.data as TokenPair);
        router.push('/portal');
      }
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setError(msg);
    }
  }

  async function onMfaSubmit(data: MfaForm) {
    setError(null);
    try {
      const result = await apiClient.post<TokenPair>('/auth/mfa/challenge', {
        mfaToken,
        code: data.code,
      });
      storeTokens(result.data.data);
      router.push('/portal');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setError(msg);
    }
  }

  if (mfaToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold">Two-factor authentication</h1>
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Verification code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                className="w-full rounded-md border bg-background px-3 py-2 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
                {...mfaForm.register('code')}
              />
              {mfaForm.formState.errors.code && (
                <p className="text-sm text-destructive">
                  {mfaForm.formState.errors.code.message}
                </p>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={mfaForm.formState.isSubmitting}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {mfaForm.formState.isSubmitting ? 'Verifying…' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={() => setMfaToken(null)}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">EdMgtWorkflows</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your account
          </p>
        </div>

        <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              {...loginForm.register('email')}
            />
            {loginForm.formState.errors.email && (
              <p className="text-sm text-destructive">
                {loginForm.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              {...loginForm.register('password')}
            />
            {loginForm.formState.errors.password && (
              <p className="text-sm text-destructive">
                {loginForm.formState.errors.password.message}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loginForm.formState.isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loginForm.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

function storeTokens(tokens: TokenPair) {
  // Access token in memory (sessionStorage), refresh token in httpOnly cookie
  // In production: use server-side session or httpOnly cookies for refresh token
  sessionStorage.setItem('access_token', tokens.accessToken);
  localStorage.setItem('refresh_token', tokens.refreshToken);
}

function extractErrorMessage(err: unknown): string {
  if (
    err !== null &&
    typeof err === 'object' &&
    'response' in err
  ) {
    const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
    return axiosErr.response?.data?.error?.message ?? 'An error occurred';
  }
  return 'An error occurred';
}
