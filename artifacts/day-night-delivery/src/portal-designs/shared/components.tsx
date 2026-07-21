/**
 * DAY NIGHT MERCHANT PORTAL - SHARED UI PRIMITIVES
 * Production-ready reusable components
 */

import React from 'react';
import { merchantDesignTokens } from './designTokens';

const tokens = merchantDesignTokens;

// ==================== BUTTON ====================

export interface PortalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

export const PortalButton: React.FC<PortalButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-[#D4AF37] hover:bg-[#E2C05A] text-[#071A33] focus:ring-[#D4AF37]',
    secondary: 'bg-[#071A33] hover:bg-[#0A1C3A] text-white focus:ring-[#071A33]',
    outline: 'border border-[#DCE4EE] bg-white hover:bg-[#F7FAFC] text-[#071A33] focus:ring-[#D4AF37]',
    ghost: 'bg-transparent hover:bg-[#F7FAFC] text-[#071A33] focus:ring-[#D4AF37]',
    danger: 'bg-[#EF4444] hover:bg-[#DC2626] text-white focus:ring-[#EF4444]',
  };
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
      {children}
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};

// ==================== CARD ====================

export interface PortalCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

export const PortalCard: React.FC<PortalCardProps> = ({
  children,
  className = '',
  padding = 'md',
  hoverable = false,
}) => {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4 md:p-5',
    lg: 'p-6',
  };
  
  return (
    <div
      className={`
        bg-white rounded-2xl border border-[#DCE4EE]
        shadow-sm
        ${hoverable ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}
        ${paddingStyles[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

// ==================== STATUS BADGE ====================

export type StatusType = 
  | 'pending' | 'confirmed' | 'assigned' | 'accepted' | 'picked_up'
  | 'in_transit' | 'out_for_delivery' | 'delivered'
  | 'failed' | 'returned' | 'cancelled' | 'postponed' | 'under_review';

export interface PortalStatusBadgeProps {
  status: StatusType | string;
  compact?: boolean;
}

export const PortalStatusBadge: React.FC<PortalStatusBadgeProps> = ({ status, compact = false }) => {
  const statusConfig: Record<string, { label: string; colors: string }> = {
    pending: { label: 'Pending', colors: 'bg-[#F0F9FF] text-[#0D47A1] border-[#BAE6FD]' },
    confirmed: { label: 'Confirmed', colors: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' },
    assigned: { label: 'Assigned', colors: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]' },
    accepted: { label: 'Accepted', colors: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' },
    picked_up: { label: 'Picked Up', colors: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]' },
    in_transit: { label: 'In Transit', colors: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]' },
    out_for_delivery: { label: 'Out for Delivery', colors: 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]' },
    delivered: { label: 'Delivered', colors: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' },
    failed: { label: 'Failed', colors: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' },
    returned: { label: 'Returned', colors: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' },
    cancelled: { label: 'Cancelled', colors: 'bg-[#F9FAFB] text-[#475569] border-[#E2E8F0]' },
    postponed: { label: 'Postponed', colors: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]' },
    under_review: { label: 'Under Review', colors: 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]' },
  };
  
  const config = statusConfig[status.toLowerCase()] || { 
    label: status, 
    colors: 'bg-[#F9FAFB] text-[#475569] border-[#E2E8F0]' 
  };
  
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border
        ${compact ? 'px-2 py-0.5 text-[10px]' : ''}
        ${config.colors}
      `}
    >
      {config.label}
    </span>
  );
};

// ==================== SKELETON ====================

export interface PortalSkeletonProps {
  className?: string;
  variant?: 'text' | 'title' | 'avatar' | 'card' | 'thumbnail';
}

export const PortalSkeleton: React.FC<PortalSkeletonProps> = ({ 
  className = '', 
  variant = 'text' 
}) => {
  const variantStyles = {
    text: 'h-4 rounded',
    title: 'h-6 rounded-lg',
    avatar: 'w-10 h-10 rounded-full',
    card: 'h-32 rounded-xl',
    thumbnail: 'w-full h-24 rounded-lg',
  };
  
  return (
    <div
      className={`animate-pulse bg-[#E2E8F0] ${variantStyles[variant]} ${className}`}
    />
  );
};

// ==================== EMPTY STATE ====================

export interface PortalEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const PortalEmptyState: React.FC<PortalEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {icon || (
        <div className="w-16 h-16 rounded-full bg-[#F7FAFC] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#98A2B3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
      )}
      <h3 className="text-lg font-bold text-[#071A33] mb-1">{title}</h3>
      {description && <p className="text-sm text-[#64748B] mb-4 max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

// ==================== ERROR STATE ====================

export interface PortalErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const PortalErrorState: React.FC<PortalErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="w-16 h-16 rounded-full bg-[#FEF2F2] flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-[#071A33] mb-1">{title}</h3>
      {message && <p className="text-sm text-[#64748B] mb-4">{message}</p>}
      {onRetry && (
        <PortalButton onClick={onRetry} variant="outline">
          Try Again
        </PortalButton>
      )}
    </div>
  );
};

// ==================== MONEY DISPLAY ====================

export interface PortalMoneyProps {
  amount: number | null | undefined;
  currency?: string;
  locale?: string;
  showSymbol?: boolean;
  className?: string;
}

export const PortalMoney: React.FC<PortalMoneyProps> = ({
  amount,
  currency = 'AED',
  locale = 'en-AE',
  showSymbol = true,
  className = '',
}) => {
  if (amount === null || amount === undefined) {
    return <span className={`text-[#98A2B3] ${className}`}>—</span>;
  }
  
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  
  return (
    <span className={`font-semibold text-[#071A33] ${className}`}>
      {showSymbol ? formatted : amount.toFixed(2)}
    </span>
  );
};

// ==================== DATE TIME DISPLAY ====================

export interface PortalDateTimeProps {
  value: string | Date | null | undefined;
  format?: 'short' | 'medium' | 'long' | 'relative';
  showTime?: boolean;
  locale?: string;
  className?: string;
}

export const PortalDateTime: React.FC<PortalDateTimeProps> = ({
  value,
  format = 'medium',
  showTime = false,
  locale = 'en-AE',
  className = '',
}) => {
  if (!value) {
    return <span className={`text-[#98A2B3] ${className}`}>—</span>;
  }
  
  const date = typeof value === 'string' ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) {
    return <span className={`text-[#98A2B3] ${className}`}>—</span>;
  }
  
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: format,
    ...(showTime && { timeStyle: 'short' }),
  };
  
  return (
    <span className={`text-[#344054] ${className}`}>
      {date.toLocaleDateString(locale, options)}
    </span>
  );
};

// ==================== SEARCH FIELD ====================

export interface PortalSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const PortalSearchField: React.FC<PortalSearchFieldProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  autoFocus,
}) => {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#DCE4EE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent placeholder-[#98A2B3]"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[#F7FAFC] rounded"
        >
          <svg className="w-4 h-4 text-[#98A2B3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

// ==================== CONFIRMATION DIALOG ====================

export interface PortalConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
}

export const PortalConfirmationDialog: React.FC<PortalConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
        <h3 className="text-lg font-bold text-[#071A33] mb-2">{title}</h3>
        <p className="text-[#64748B] mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <PortalButton variant="outline" onClick={onClose}>
            {cancelText}
          </PortalButton>
          <PortalButton 
            variant={variant === 'danger' ? 'danger' : 'primary'} 
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </PortalButton>
        </div>
      </div>
    </div>
  );
};
