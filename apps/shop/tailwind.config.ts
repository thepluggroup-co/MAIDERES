import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          magenta: '#A82D7E',
          'magenta-dark': '#7A1F5C',
          'magenta-light': '#F7E4F0',
          indigo: '#254C8C',
          'indigo-dark': '#1B3D6E',
          'indigo-light': '#E4EAF4',
          gold: '#F2A93B',
          'gold-dark': '#5A3E08',
          'gold-light': '#FDEFD6',
          ink: '#1F2430',
          'ink-soft': '#5F5E5A',
        },
        status: {
          success: '#3B6D11',
          'success-bg': '#EAF3DE',
          warning: '#854F0B',
          'warning-bg': '#FAEEDA',
          info: '#185FA5',
          'info-bg': '#E6F1FB',
          error: '#A32D2D',
          'error-bg': '#FCEBEB',
        },
      },
      fontFamily: {
        display: ['Poppins', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
