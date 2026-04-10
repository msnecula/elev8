'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { APP_URL } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';

const schema = z.object({ email: z.string().email('Invalid email address') });
type Input = z.infer<typeof schema>;

export default function ForgotPasswordForm() {
  const supabase = createClient();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Input>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Input) {
    setServerError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${APP_URL}/api/auth/callback?next=/reset-password`,
    });
    if (error) { setServerError(error.message); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <Card className="shadow-lg">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Check your email</h2>
            <p className="text-sm text-muted-foreground mt-1">
              We've sent a password reset link. Check your inbox and follow the instructions.
            </p>
          </div>
          <Link href="/login" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <ArrowLeft className="h-3 w-3" /> Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold text-center">Reset your password</CardTitle>
        <CardDescription className="text-center">Enter your email and we'll send you a reset link</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" placeholder="you@company.com" {...register('email')} className={errors.email ? 'border-destructive' : ''} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : 'Send Reset Link'}
          </Button>
          <div className="text-center">
            <Link href="/login" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
