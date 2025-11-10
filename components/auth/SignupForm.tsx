'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { signupSchema, type SignupInput } from '@/lib/utils/validation'
import { useRouter } from 'next/navigation'

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupInput) => {
    try {
      setLoading(true)
      setError(null)

      // Sign up user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            contact_no: data.contact_no || null,
          },
        },
      })

      if (signUpError) {
        // Log the full error for debugging
        console.error('Signup error:', signUpError)
        
        // Handle specific Supabase errors
        if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
          setError('An account with this email already exists. Please sign in instead.')
        } else if (signUpError.message.includes('invalid') || signUpError.message.includes('Invalid')) {
          setError('Please enter a valid email address.')
        } else {
          // Show the actual error message from Supabase
          setError(signUpError.message || 'Failed to sign up. Please try again.')
        }
        return
      }

      if (authData.user) {
        // Create user profile in public.users table
        const { error: profileError } = await supabase.from('users').insert({
          id: authData.user.id,
          email: data.email,
          full_name: data.full_name,
          contact_no: data.contact_no || null,
        })

        if (profileError) {
          // If profile creation fails but user was created, still allow login
          console.error('Profile creation error:', profileError)
          // Don't throw - user can still sign in and profile can be created later
        }

        // Check if email confirmation is required
        if (authData.session) {
          // User is immediately signed in (email confirmation disabled)
          router.push('/chat')
          router.refresh()
        } else {
          // Email confirmation required
          setError('Please check your email to confirm your account before signing in.')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign up. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-text-primary mb-1">
            Full Name
          </label>
          <input
            id="full_name"
            type="text"
            {...register('full_name')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="John Doe"
          />
          {errors.full_name && (
            <p className="mt-1 text-sm text-error">{errors.full_name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            {...register('email')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="your@email.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-error">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            {...register('password')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-error">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="contact_no" className="block text-sm font-medium text-text-primary mb-1">
            Contact Number (Optional)
          </label>
          <input
            id="contact_no"
            type="tel"
            {...register('contact_no')}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
            placeholder="+1234567890"
          />
          {errors.contact_no && (
            <p className="mt-1 text-sm text-error">{errors.contact_no.message}</p>
          )}
        </div>

        {error && (
          <div className="p-3 bg-error/10 border border-error rounded-lg">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-secondary text-white py-2 px-4 rounded-lg font-medium hover:bg-secondary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing up...' : 'Sign Up'}
        </button>
      </form>
    </div>
  )
}

