'use client'
import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva('button', {
  variants: { variant: { primary: '', secondary: 'secondary' } },
  defaultVariants: { variant: 'primary' },
})

export function Button({
  className,
  variant,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, className }))}
      nativeButton={nativeButton ?? (props.render ? false : undefined)}
      {...props}
    />
  )
}
