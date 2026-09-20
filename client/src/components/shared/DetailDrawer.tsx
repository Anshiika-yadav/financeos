import React, { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface DetailDrawerProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  tabs: Tab[];
  actions?: ReactNode;
  /** Default tab id — defaults to first */
  defaultTab?: string;
  /** Width class override */
  width?: string;
}

export function DetailDrawer({
  title,
  subtitle,
  onClose,
  tabs,
  actions,
  defaultTab,
  width = 'w-[600px]',
}: DetailDrawerProps) {
  const [activeTab, setActiveTab] = React.useState(defaultTab ?? tabs[0]?.id ?? '');

  // Close on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onClose]);

  // Trap body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <>
      {/* Overlay */}
      <div
        className="drawer-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={clsx('drawer-panel', width, 'max-w-full')}
        role="complementary"
        aria-label={title}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-ink-900 truncate">{title}</h2>
            {subtitle && (
              <p className="text-[13px] text-ink-600 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {actions}
            <button
              onClick={onClose}
              className="text-ink-400 hover:text-ink-900 p-1.5 rounded transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        {tabs.length > 1 && (
          <div className="flex border-b border-border bg-surface-50 flex-shrink-0 px-6 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-px',
                  activeTab === tab.id
                    ? 'border-gold-500 text-ink-900'
                    : 'border-transparent text-ink-600 hover:text-ink-900',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeContent}
        </div>
      </aside>
    </>
  );
}
