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
        primary: 'rgb(var(--rgb-primary) / <alpha-value>)',
        'primary-light': 'rgb(var(--rgb-primary-light) / <alpha-value>)',
        'primary-dark': 'rgb(var(--rgb-primary-dark) / <alpha-value>)',
        accent: 'rgb(var(--rgb-accent) / <alpha-value>)',
        'accent-light': 'rgb(var(--rgb-accent-light) / <alpha-value>)',
        'accent-dark': 'rgb(var(--rgb-accent-dark) / <alpha-value>)',
        background: 'rgb(var(--rgb-background) / <alpha-value>)',
        'background-gradient': 'rgb(var(--rgb-background-gradient) / <alpha-value>)',
        surface: 'rgb(var(--rgb-surface) / <alpha-value>)',
        text: 'rgb(var(--rgb-text) / <alpha-value>)',
        'text-primary': 'rgb(var(--rgb-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--rgb-text-secondary) / <alpha-value>)',
        'text-accent': 'rgb(var(--rgb-text-accent) / <alpha-value>)',
        success: 'rgb(var(--rgb-success) / <alpha-value>)',
        error: 'rgb(var(--rgb-error) / <alpha-value>)',
        warning: 'rgb(var(--rgb-warning) / <alpha-value>)',
        info: 'rgb(var(--rgb-info) / <alpha-value>)',
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
