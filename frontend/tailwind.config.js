/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
        extend: {
                fontFamily: {
                        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
                        heading: ['Outfit', 'system-ui', 'sans-serif'],
                        mono: ['JetBrains Mono', 'monospace'],
                },
                borderRadius: {
                        lg: 'var(--radius)',
                        md: 'calc(var(--radius) - 2px)',
                        sm: 'calc(var(--radius) - 4px)'
                },
                colors: {
                        background: 'hsl(var(--background))',
                        foreground: 'hsl(var(--foreground))',
                        card: {
                                DEFAULT: 'hsl(var(--card))',
                                foreground: 'hsl(var(--card-foreground))'
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover))',
                                foreground: 'hsl(var(--popover-foreground))'
                        },
                        primary: {
                                DEFAULT: 'hsl(var(--primary))',
                                foreground: 'hsl(var(--primary-foreground))'
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--secondary))',
                                foreground: 'hsl(var(--secondary-foreground))'
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted))',
                                foreground: 'hsl(var(--muted-foreground))'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--accent))',
                                foreground: 'hsl(var(--accent-foreground))'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive))',
                                foreground: 'hsl(var(--destructive-foreground))'
                        },
                        border: 'hsl(var(--border))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        chart: {
                                '1': 'hsl(var(--chart-1))',
                                '2': 'hsl(var(--chart-2))',
                                '3': 'hsl(var(--chart-3))',
                                '4': 'hsl(var(--chart-4))',
                                '5': 'hsl(var(--chart-5))'
                        },
                        klein: {
                                DEFAULT: '#0047AB',
                                50: '#E6F0FF',
                                100: '#CCE0FF',
                                200: '#99C2FF',
                                300: '#66A3FF',
                                400: '#3385FF',
                                500: '#0066FF',
                                600: '#0047AB',
                                700: '#003380',
                                800: '#002255',
                                900: '#00112B'
                        },
                        signal: {
                                DEFAULT: '#FF4500',
                                50: '#FFF0EB',
                                100: '#FFE1D6',
                                200: '#FFC3AD',
                                300: '#FFA585',
                                400: '#FF875C',
                                500: '#FF6933',
                                600: '#FF4500',
                                700: '#CC3700',
                                800: '#992900',
                                900: '#661C00'
                        }
                },
                keyframes: {
                        'accordion-down': {
                                from: {
                                        height: '0'
                                },
                                to: {
                                        height: 'var(--radix-accordion-content-height)'
                                }
                        },
                        'accordion-up': {
                                from: {
                                        height: 'var(--radix-accordion-content-height)'
                                },
                                to: {
                                        height: '0'
                                }
                        },
                        'slide-up': {
                                from: {
                                        transform: 'translateY(100%)',
                                        opacity: '0'
                                },
                                to: {
                                        transform: 'translateY(0)',
                                        opacity: '1'
                                }
                        },
                        'fade-in': {
                                from: {
                                        opacity: '0'
                                },
                                to: {
                                        opacity: '1'
                                }
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                        'slide-up': 'slide-up 0.3s ease-out',
                        'fade-in': 'fade-in 0.2s ease-out'
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
};
