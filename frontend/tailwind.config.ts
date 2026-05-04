import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1F7E5F',
          50:  '#E8F5F0',
          100: '#C5E5D9',
          200: '#9DD4C0',
          300: '#75C3A7',
          400: '#4DB28E',
          500: '#1F7E5F',
          600: '#196849',
          700: '#135133',
          800: '#0D3A1D',
          900: '#072307',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#2D5A3D',
          dark:    '#1A3D26',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#FFB84D',
          light:   '#FFCF80',
          dark:    '#E0972C',
          foreground: '#1A1A1A',
        },
        neutral: {
          DEFAULT: '#F5F5F5',
          dark:    '#E0E0E0',
          foreground: '#1A1A1A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};

export default config;
