'use client'
import { ThemeProvider, useTheme } from 'next-themes'
import { SunMoon } from 'lucide-react'
export function Theme({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system">
      {children}
    </ThemeProvider>
  )
}
export function Toggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <button
      className="icon-button"
      aria-label="Prepnúť farebný režim"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <SunMoon size={19} />
    </button>
  )
}
