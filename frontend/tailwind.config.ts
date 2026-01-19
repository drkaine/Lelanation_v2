import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}',
    './layouts/**/*.{vue,js,ts}',
    './app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-light': 'var(--color-primary-light)',
        'primary-dark': 'var(--color-primary-dark)',
        accent: 'var(--color-accent)',
        'accent-light': 'var(--color-accent-light)',
        'accent-dark': 'var(--color-accent-dark)',
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        text: 'var(--color-text)',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: 'var(--color-blue-100)',
      },
      spacing: {
        ...defaultTheme.spacing,
        '1': '0.5rem', // 8px
        '2': '1rem', // 16px
        '3': '1.5rem', // 24px
        '4': '2rem', // 32px
        '5': '2.5rem', // 40px
        '6': '3rem', // 48px
        '7': '3.5rem', // 56px
        '8': '4rem', // 64px
        '9': '4.5rem', // 72px
        '10': '5rem', // 80px
        '11': '5.5rem', // 88px
        '12': '6rem', // 96px
        '14': '7rem', // 112px
        '16': '8rem', // 128px
        '20': '10rem', // 160px
        '24': '12rem', // 192px
        '28': '14rem', // 224px
        '32': '16rem', // 256px
      },
    },
  },
  plugins: [],
} satisfies Config
