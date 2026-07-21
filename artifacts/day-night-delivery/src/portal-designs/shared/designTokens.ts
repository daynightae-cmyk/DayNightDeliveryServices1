/**
 * DAY NIGHT MERCHANT PORTAL - DESIGN TOKENS
 * Official brand identity: Deep Navy, Royal Blue, Sky Blue, Premium Gold
 */

export const merchantDesignTokens = {
  colors: {
    // Primary Brand Colors
    navy: {
      950: '#07101E',
      900: '#071A33',
      800: '#0A1C3A',
      700: '#0D2142',
    },
    blue: {
      700: '#0D47A1',
      600: '#1259D5',
      500: '#1976D2',
      400: '#3B8FE8',
    },
    sky: {
      500: '#38BDF8',
      400: '#5CC8FF',
      300: '#8FDBFF',
    },
    gold: {
      600: '#B5942B',
      500: '#D4AF37',
      400: '#E2C05A',
      300: '#F0D77A',
    },
    
    // Surfaces
    background: {
      primary: '#F4F7FB',
      secondary: '#F7F5EA',
      tertiary: '#F7FAFC',
      paper: '#FFFFFF',
    },
    surface: {
      default: '#FFFFFF',
      muted: '#EEF3F8',
      elevated: '#F8FAFC',
    },
    
    // Text
    text: {
      primary: '#071A33',
      secondary: '#344054',
      muted: '#64748B',
      disabled: '#98A2B3',
      inverse: '#FFFFFF',
      gold: '#9A7204',
    },
    
    // Borders
    border: {
      default: '#DCE4EE',
      muted: '#E2E8F0',
      strong: '#CBD5E1',
    },
    
    // Semantic
    success: '#22C55E',
    successBg: '#F0FDF4',
    successBorder: '#BBF7D0',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    info: '#38BDF8',
    infoBg: '#F0F9FF',
    infoBorder: '#BAE6FD',
  },
  
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '40px',
    '5xl': '48px',
  },
  
  radius: {
    sm: '12px',
    md: '16px',
    lg: '22px',
    xl: '28px',
    '2xl': '32px',
    full: '9999px',
  },
  
  shadows: {
    sm: '0 4px 14px rgba(7, 26, 51, 0.06)',
    md: '0 12px 30px rgba(7, 26, 51, 0.10)',
    lg: '0 20px 48px rgba(7, 26, 51, 0.14)',
    xl: '0 34px 90px rgba(2, 18, 38, 0.24)',
  },
  
  typography: {
    fontFamily: {
      en: 'Inter, system-ui, sans-serif',
      ar: 'IBM Plex Sans Arabic, Tajawal, system-ui, sans-serif',
    },
    fontSize: {
      xs: '12px',
      sm: '13px',
      base: '15px',
      lg: '16px',
      xl: '18px',
      '2xl': '20px',
      '3xl': '24px',
      '4xl': '32px',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
  },
  
  transitions: {
    fast: '150ms ease',
    base: '200ms ease',
    slow: '300ms ease',
  },
  
  zIndex: {
    base: 1,
    dropdown: 10,
    sticky: 20,
    overlay: 30,
    modal: 40,
    popover: 50,
    tooltip: 60,
  },
} as const;

export type MerchantDesignTokens = typeof merchantDesignTokens;
