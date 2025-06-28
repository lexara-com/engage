/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'lexara': {
          'primary': '#1E2B3B',      // Dark Navy (Brand Primary)
          'secondary': '#3B576C',    // Light Navy (Brand Secondary)  
          'accent': '#76444B',       // Mahogany (Brand Accent)
          'light': '#C6D8DB',        // Sky Blue (Brand Light)
          'background': '#F3F0ED',   // White Smoke (Brand Background)
          'white': '#FFFFFF',        // Pure White
          'gray': '#6b7280',         // Neutral Gray
          'error': '#ef4444',        // Red-500
          'warning': '#f59e0b',      // Amber-500
          'success': '#10b981'       // Emerald-500
        }
      },
      fontFamily: {
        'serif': ['Lora', 'serif'],        // Brand Headlines
        'sans': ['Open Sans', 'system-ui', 'sans-serif'],  // Brand Body Text
        'display': ['Lora', 'serif']       // Brand Display Text
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
}