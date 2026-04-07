import React from 'react';

type SecondaryTabShellProps = {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
};

export function SecondaryTabShell({
  icon: Icon,
  label,
  children,
}: SecondaryTabShellProps) {
  return (
    <div className="secondary-view-shell">
      <div className="secondary-view-header">
        <div className="secondary-view-title-row">
          <div className="secondary-view-icon">
            <Icon size={18} />
          </div>
          <div>
            <div className="secondary-view-title">{label}</div>
          </div>
        </div>
      </div>
      <div className="secondary-view-body">
        {children}
      </div>
    </div>
  );
}
