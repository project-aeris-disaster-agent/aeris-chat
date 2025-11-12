import { redirect } from 'next/navigation'
import Link from 'next/link'

import { SignupForm } from '@/components/auth/SignupForm'
import { CanvasRevealEffect } from '@/components/ui'
import { AUTH_DISABLED } from '@/lib/config'

export default function SignupPage() {
  if (AUTH_DISABLED) {
    redirect('/chat')
  }

  return (
    <main className="relative flex min-h-viewport flex-col items-center justify-center px-4 py-6 sm:p-8 bg-primary overflow-hidden pt-safe pb-safe">
      {/* Background Canvas Reveal Effect */}
      <div className="absolute inset-0 z-0">
        <CanvasRevealEffect
          animationSpeed={0.5}
          colors={[[59, 130, 246], [147, 51, 234]]}
          opacities={[0.1, 0.1, 0.1, 0.2, 0.2, 0.2, 0.3, 0.3, 0.3, 0.4]}
          dotSize={3}
          containerClassName="opacity-50"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Create Account</h1>
          <p className="text-text-secondary">Sign up to get started</p>
        </div>
        <SignupForm />
        <div className="mt-6 text-center">
          <p className="text-text-secondary">
            Already have an account?{' '}
            <Link href="/login" className="text-secondary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

