import { redirect } from 'next/navigation'
import Link from 'next/link'

import { LoginForm } from '@/components/auth/LoginForm'
import { AUTH_DISABLED } from '@/lib/config'

// Mark as dynamic to prevent static generation issues
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  if (AUTH_DISABLED) {
    redirect('/chat')
  }

  return (
    <main className="flex min-h-viewport flex-col items-center justify-center px-4 py-6 sm:p-8 bg-primary pt-safe pb-safe">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Welcome Back</h1>
          <p className="text-text-secondary">Sign in to your account</p>
        </div>
        <LoginForm />
        <div className="mt-6 text-center">
          <p className="text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-secondary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

