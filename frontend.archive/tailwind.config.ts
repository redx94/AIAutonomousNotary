import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8eaf2',
          100: '#c5c9df',
          200: '#9ea5c9',
          300: '#7781b3',
          400: '#5a65a3',
          500: '#3d4993',
          600: '#2e3878',
          700: '#1e265c',
          800: '#111640',
          900: '#0a0e1a',
          950: '#060810',
        },
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          glow: '#00d4ff',
        },
        purple: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        glass: {
          light: 'rgba(255,255,255,0.05)',
          border: 'rgba(255,255,255,0.1)',
          hover: 'rgba(255,255,255,0.08)',
        },
      },
      backgroundImage: {
        'hero-gradient': 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.3) 0%, rgba(10,14,26,0) 60%), radial-gradient(ellipse at 80% 50%, rgba(0,212,255,0.15) 0%, rgba(10,14,26,0) 50%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        'accent-gradient': 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        'cyan-glow': '0 0 20px rgba(0,212,255,0.4)',
        'purple-glow': '0 0 20px rgba(124,58,237,0.4)',
        'card-hover': '0 20px 40px rgba(0,0,0,0.6)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0,212,255,0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(0,212,255,0.7)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      backdropBlur: {
        glass: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
