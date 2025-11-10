// Validation utilities using Zod

import { z } from 'zod'

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .transform((email) => email.toLowerCase().trim()) // Normalize email to lowercase

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().min(1, 'Name is required').max(100),
  contact_no: z.string().optional(),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const profileUpdateSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  contact_no: z.string().optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
