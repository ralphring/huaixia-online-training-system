/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			colors: {
				primary: {
					50: '#EBF5FF',
					100: '#D1E9FF',
					500: '#3B82F6',
					700: '#1D4ED8',
					900: '#1E3A8A',
				},
				neutral: {
					50: '#FAFAFA',
					100: '#F5F5F5',
					200: '#E5E5E5',
					400: '#A3A3A3',
					700: '#404040',
					900: '#171717',
				},
				success: {
					100: '#D1FAE5',
					500: '#10B981',
					700: '#047857',
				},
				warning: {
					500: '#F59E0B',
				},
				error: {
					50: '#FEF2F2',
					500: '#EF4444',
				},
				info: {
					500: '#3B82F6',
				},
			},
			borderRadius: {
				sm: '8px',
				md: '12px',
				lg: '16px',
				xl: '12px',
				'2xl': '16px',
			},
			boxShadow: {
				sm: '0 1px 2px rgba(0,0,0,0.05)',
				card: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
				'card-hover': '0 10px 20px rgba(59,130,246,0.15), 0 3px 6px rgba(0,0,0,0.1)',
				modal: '0 20px 40px rgba(0,0,0,0.15)',
			},
			transitionDuration: {
				200: '200ms',
				250: '250ms',
				300: '300ms',
			},
			keyframes: {
				'accordion-down': {
					from: { height: 0 },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: 0 },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
}