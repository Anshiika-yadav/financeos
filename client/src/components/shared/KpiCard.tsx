import React, { ReactNode } from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Accent = 'default' | 'gold' | 'success' | 'warning' | 'danger' | 'info';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: Accent;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  /** Small icon above the label */
  icon?: ReactNode;
}

const ACCENT_CLASSES: Record<Accent, { border: string; value: string }> = {
  default: { border: 'border-l-border-strong',  value: 'text-ink-900' },
  gold:    { border: 'border-l-gold-500',        value: 'text-gold-600' },
  success: { border: 'border-l-success',         value: 'text-success' },
  warning: { border: 'border-l-warning',         value: 'text-warning' },
  danger:  { border: 'border-l-danger',          value: 'text-danger' },
  info:    { border: 'border-l-info',            value: 'text-info' },
};

const TREND_CONFIG = {
  up:   { icon: TrendingUp,   color: 'text-success' },
  down: { icon: TrendingDown, color: 'text-danger' },
  flat: { icon: Minus,        color: 'text-ink-400' },
};

export function KpiCard({
  label,
  value,
  sub,
  accent = 'default',
  trend,
  trendLabel,
  icon,
}: KpiCardProps) {
  const { border, value: valueColor } = ACCENT_CLASSES[accent];
  const TrendIcon = trend ? TREND_CONFIG[trend].icon : null;
  const trendColor = trend ? TREND_CONFIG[trend].color : '';

  return (
    <div className={clsx('stat-card border-l-4', border)}>
      {icon && <div className="text-ink-400 mb-2">{icon}</div>}
      <p className="stat-card__label">{label}</p>
      <p className={clsx('stat-card__value', valueColor)}>{value}</p>
      {(sub || (TrendIcon && trendLabel)) && (
        <div className="flex items-center gap-1.5 mt-1">
          {TrendIcon && trendLabel && (
            <span className={clsx('flex items-center gap-0.5 text-[11px] font-medium', trendColor)}>
              <TrendIcon className="w-3 h-3" aria-hidden />
              {trendLabel}
            </span>
          )}
          {sub && !trendLabel && (
            <span className="stat-card__sub">{sub}</span>
          )}
          {sub && trendLabel && (
            <span className="text-[11px] text-ink-400">{sub}</span>
          )}
        </div>
      )}
    </div>
  );
}
