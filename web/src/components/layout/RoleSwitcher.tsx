import React from 'react';
import { cn } from '../../lib/utils';
import type { UserRole } from '../../types';
import { User, Shield, Search, Scale } from 'lucide-react';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

const roles: { id: UserRole; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'signer', label: 'Signer', icon: User, description: 'Document owner' },
  { id: 'notary', label: 'Notary', icon: Scale, description: 'Authority provider' },
  { id: 'compliance', label: 'Compliance', icon: Shield, description: 'Audit & ops' },
  { id: 'verifier', label: 'Verifier', icon: Search, description: 'Public verification' },
];

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  currentRole,
  onRoleChange,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const currentRoleData = roles.find(r => r.id === currentRole);
  const CurrentIcon = currentRoleData?.icon || User;
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 transition-colors"
      >
        <CurrentIcon className="w-4 h-4 text-neutral-600" />
        <span className="text-sm font-medium text-neutral-700">{currentRoleData?.label}</span>
        <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-neutral-200 z-50 py-1">
            <div className="px-3 py-2 border-b border-neutral-100">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Switch Role</p>
            </div>
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <button
                  key={role.id}
                  onClick={() => {
                    onRoleChange(role.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    currentRole === role.id 
                      ? 'bg-primary-50 text-primary-700' 
                      : 'hover:bg-neutral-50 text-neutral-700'
                  )}
                >
                  <Icon className={cn(
                    'w-5 h-5',
                    currentRole === role.id ? 'text-primary-600' : 'text-neutral-400'
                  )} />
                  <div>
                    <p className="text-sm font-medium">{role.label}</p>
                    <p className="text-xs text-neutral-500">{role.description}</p>
                  </div>
                  {currentRole === role.id && (
                    <svg className="w-5 h-5 text-primary-600 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
