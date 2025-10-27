/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],  theme: {
    extend: {
      colors: {
        Background: {
          light: 'var(--light-color)',
          DEFAULT: 'var(--bg-color)',
          dark: 'var(--text-secondary)',
        },
        Text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          blue: 'var(--button-bg-color)',
        },
        Button: {
          bgColor: 'var(--button-bg-color)',
          bgHiddenColor: 'var(--button-bg-hidden-color)',
          blue: 'var(--button-bg-color)',
        },
        DangerColor: {
          DEFAULT: 'var(--danger)',
        } 
      },
      borderColor: {
        color: {
          blue: 'var(--button-bg-color)',
          gray: 'var(--text-primary)',
        }
      },
      boxShadow: {
        boxShadow: {
          DEFAULT: 'var(--default-boxShadow)',
        }
      },
      fontFamily: {
        Roboto: ['Roboto', 'sans-serif']
      },
      padding: {  
        '22': '5.5rem',
      },
      borderRadius: {
        '1': '1px'
      },
      borderWidth: {
        '0.5': '0.5px'
      },
      height: {
        '58': '14.5rem'
      }
    },
  },
  plugins: [],
}

