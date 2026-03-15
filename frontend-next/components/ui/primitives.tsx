'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'danger' }
) {
  const { className, variant = 'default', ...rest } = props
  const variantClass = {
    default:
      'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[0_10px_26px_rgba(37,99,235,0.35)] hover:brightness-110',
    outline: 'border border-border bg-card/70 hover:bg-muted/80',
    ghost: 'hover:bg-muted/70',
    danger: 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-[0_10px_26px_rgba(239,68,68,0.3)] hover:brightness-110',
  }[variant]
  return (
    <button
      className={cn(
        'rounded-xl px-3 py-2 text-sm font-medium transition duration-200 disabled:opacity-50 sm:px-4',
        variantClass,
        className
      )}
      {...rest}
    />
  )
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass-card hover-lift rounded-2xl p-3 sm:p-4', className)} {...props} />
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none ring-primary focus:ring-2',
        props.className
      )}
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none ring-primary focus:ring-2',
        props.className
      )}
    />
  )
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-xl border border-border bg-background/80 px-3 py-2 text-sm outline-none ring-primary focus:ring-2',
        props.className
      )}
    />
  )
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('inline-flex rounded-full border border-border bg-muted/80 px-2.5 py-1 text-xs font-medium', className)}
      {...props}
    />
  )
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">{subtitle}</p> : null}
    </div>
  )
}
