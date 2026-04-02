import React from 'react';
import { cn } from '../../lib/utils';
import { Navigation } from './Navigation';
import { RoleSwitcher } from './RoleSwitcher';
import type { UserRole } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentRole,
  onRoleChange,
  className,
}) => {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-neutral-900">AI Autonomous Notary</h1>
                <p className="text-xs text-neutral-500">Compliant Mode Active</p>
              </div>
            </div>
            
            {/* Role Switcher */}
            <RoleSwitcher currentRole={currentRole} onRoleChange={onRoleChange} />
          </div>
        </div>
        
        {/* Navigation */}
        <Navigation currentRole={currentRole} />
      </header>
      
      {/* Main Content */}
      <main className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8', className)}>
        {children}
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-neutral-500">
            <p>AI Autonomous Notary — Compliant Mode</p>
            <p>Legal authority: Human-supervised off-chain</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
