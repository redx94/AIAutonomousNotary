import { cn } from '../../lib/utils';
import type { UserRole } from '../../types';
import { 
  Home, FileText, UserCheck, Video, Package, 
  ListTodo, Search, Shield, 
  Database, Settings, Globe
} from 'lucide-react';

interface NavigationProps {
  currentRole: UserRole;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navConfig: Record<UserRole, NavItem[]> = {
  signer: [
    { label: 'Home', path: '/signer', icon: Home },
    { label: 'My Case', path: '/signer/case', icon: FileText },
    { label: 'Identity Check', path: '/signer/identity', icon: UserCheck },
    { label: 'Session', path: '/signer/session', icon: Video },
    { label: 'Final Package', path: '/signer/final', icon: Package },
  ],
  notary: [
    { label: 'Queue', path: '/notary', icon: ListTodo },
    { label: 'Cases', path: '/notary/cases', icon: FileText },
    { label: 'Live Session', path: '/notary/session', icon: Video },
    { label: 'Evidence', path: '/notary/evidence', icon: Shield },
    { label: 'Exceptions', path: '/notary/exceptions', icon: AlertCircleIcon },
  ],
  compliance: [
    { label: 'Case Ledger', path: '/compliance', icon: Database },
    { label: 'Audit Trail', path: '/compliance/audit', icon: FileText },
    { label: 'Evidence Bundles', path: '/compliance/evidence', icon: Shield },
    { label: 'Retention', path: '/compliance/retention', icon: Settings },
    { label: 'Policy Rules', path: '/compliance/policy', icon: SettingsIcon },
  ],
  verifier: [
    { label: 'Verify Document', path: '/verify', icon: Search },
    { label: 'Verify Bundle', path: '/verify/bundle', icon: Shield },
    { label: 'Publication Status', path: '/verify/publication', icon: Globe },
  ],
};

function AlertCircleIcon(props: { className?: string }) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SettingsIcon(props: { className?: string }) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export const Navigation: React.FC<NavigationProps> = ({ currentRole }) => {
  const items = navConfig[currentRole];
  const currentPath = window.location.pathname;
  
  return (
    <nav className="bg-neutral-50 border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 overflow-x-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/');
            
            return (
              <a
                key={item.path}
                href={item.path}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  isActive 
                    ? 'border-primary-500 text-primary-700' 
                    : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:border-neutral-300'
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
