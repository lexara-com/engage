/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        lexara: {
          // Official Brand Colors
          darkNavy: '#1E2B3B',     // Primary - Dark Navy
          lightNavy: '#3B576C',    // Secondary - Light Navy  
          skyBlue: '#C6D8DB',      // Accent - Sky Blue
          mahogany: '#76444B',     // Warmth - Mahogany
          whiteSmoke: '#F3F0ED',   // Light - White Smoke
          pureWhite: '#FFFFFF',    // Clean - Pure White
          
          // Semantic aliases for easier usage
          primary: '#1E2B3B',      // Dark Navy
          secondary: '#3B576C',    // Light Navy
          accent: '#C6D8DB',       // Sky Blue
          warm: '#76444B',         // Mahogany
          light: '#F3F0ED',        // White Smoke
          gray: '#3B576C'          // Light Navy for text
        }
      },
      fontFamily: {
        // Official Brand Typography
        heading: ['Lora', 'serif'],                    // Headlines - Lora
        sans: ['Open Sans', 'system-ui', 'sans-serif'], // Body text - Open Sans
        body: ['Open Sans', 'system-ui', 'sans-serif'], // Explicit body alias
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      }
    },
  },
  plugins: [],
}