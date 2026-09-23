/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Shell / navigation ────────────────────────────────────────────────
        navy: {
          950: '#0B1220', // shell background, top bar
          900: '#111827', // hover / selected nav item
          800: '#1C2A3A', // secondary nav surface
          700: '#253347', // nav dividers
          200: '#A8B8CC', // nav text muted
          100: '#D4DFEB', // nav text default
        },
        // ── Accent ───────────────────────────────────────────────────────────
        gold: {
          600: '#A8862F', // gold dark (hover)
          500: '#C8A24A', // gold default — active nav, KPI emphasis, CTAs
          400: '#D9B96A', // gold light
          100: '#F7F0DE', // gold tint (badge bg)
          50:  '#FBF8EF', // gold wash
        },
        // ── Page surfaces ─────────────────────────────────────────────────────
        surface: {
          0:   '#FFFFFF', // cards, modals, table rows
          50:  '#F7F8FA', // page background
          100: '#EEF0F4', // subtle dividers
        },
        // ── Borders ───────────────────────────────────────────────────────────
        border: {
          DEFAULT: '#D8DEE8',
          strong:  '#B0BAC9',
        },
        // ── Text ──────────────────────────────────────────────────────────────
        ink: {
          900: '#172033', // primary text
          700: '#3D4E63', // secondary text
          600: '#667085', // tertiary / labels
          400: '#94A3B8', // placeholder
          200: '#CBD5E1', // disabled
        },
        // ── Semantic ──────────────────────────────────────────────────────────
        success: {
          DEFAULT: '#136F63',
          bg:      '#EBF7F5',
          border:  '#9ED8D2',
        },
        warning: {
          DEFAULT: '#9A6700',
          bg:      '#FFF8EB',
          border:  '#F9D98A',
        },
        danger: {
          DEFAULT: '#A61B1B',
          bg:      '#FDF1F1',
          border:  '#F5BCBC',
        },
        info: {
          DEFAULT: '#2457A6',
          bg:      '#EBF1FB',
          border:  '#A8C0E8',
        },
        // ── Keep brand alias so existing code doesn't break immediately ────────
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Finance-grade numeric KPI sizes
        'kpi-lg': ['36px', { lineHeight: '1.1', fontWeight: '600' }],
        'kpi-md': ['28px', { lineHeight: '1.15', fontWeight: '600' }],
        'kpi-sm': ['22px', { lineHeight: '1.2', fontWeight: '600' }],
      },
      borderRadius: {
        card:  '10px',
        card2: '12px',
        input: '8px',
      },
      boxShadow: {
        card:   '0 1px 4px 0 rgba(23,32,51,0.08), 0 0 0 1px rgba(216,222,232,0.6)',
        'card-hover': '0 4px 12px 0 rgba(23,32,51,0.12), 0 0 0 1px rgba(216,222,232,0.8)',
        drawer: '−4px 0 24px 0 rgba(11,18,32,0.18)',
        modal:  '0 8px 32px 0 rgba(11,18,32,0.22)',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
    },
  },
  plugins: [],
};
