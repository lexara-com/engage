/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				// Lexara.com inspired color palette
				'lexara': {
					'white': '#ffffff',
					'beige': 'rgb(243, 240, 237)',
					'blue-gray': 'rgb(198, 216, 219)',
					'navy': 'rgb(30, 43, 59)',
					'slate': 'rgb(59, 87, 108)',
					'gray-50': '#f9fafb',
					'gray-100': '#f3f4f6',
					'gray-200': '#e5e7eb',
					'gray-300': '#d1d5db',
					'gray-400': '#9ca3af',
					'gray-500': '#6b7280',
					'gray-600': '#4b5563',
					'gray-700': '#374151',
					'gray-800': '#1f2937',
					'gray-900': '#111827',
				}
			},
			fontFamily: {
				'figtree': ['Figtree', 'Inter', 'system-ui', 'sans-serif'],
				'inter': ['Inter', 'system-ui', 'sans-serif'],
			},
			animation: {
				'fade-in': 'fadeIn 0.5s ease-in-out',
				'slide-up': 'slideUp 0.3s ease-out',
				'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				},
				slideUp: {
					'0%': { transform: 'translateY(10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' },
				},
			},
		},
	},
	plugins: [],
};