import { create } from 'zustand';
import type { Case, UserRole } from '../types';
import { CaseService } from '../services/caseService';

interface CaseState {
  // Current user context
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
  
  // Cases
  cases: Case[];
  currentCase: Case | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchCases: () => Promise<void>;
  fetchCase: (actId: string) => Promise<void>;
  setCurrentCase: (caseData: Case | null) => void;
  
  // For demo: simulate state transitions
  simulateProgress: (actId: string) => Promise<void>;
}

export const useCaseStore = create<CaseState>((set, get) => ({
  currentRole: 'signer',
  setRole: (role) => set({ currentRole: role }),
  
  cases: [],
  currentCase: null,
  isLoading: false,
  error: null,
  
  fetchCases: async () => {
    set({ isLoading: true, error: null });
    try {
      const cases = await CaseService.getCases();
      set({ cases, isLoading: false });
    } catch (err) {
      set({ error: 'Failed to fetch cases', isLoading: false });
    }
  },
  
  fetchCase: async (actId: string) => {
    set({ isLoading: true, error: null });
    try {
      const caseData = await CaseService.getCase(actId);
      set({ currentCase: caseData || null, isLoading: false });
    } catch (err) {
      set({ error: 'Failed to fetch case', isLoading: false });
    }
  },
  
  setCurrentCase: (caseData) => set({ currentCase: caseData }),
  
  simulateProgress: async (actId: string) => {
    const { currentCase } = get();
    if (!currentCase || currentCase.actId !== actId) return;
    
    // Simulate a state transition
    const updatedCase = { ...currentCase };
    
    if (updatedCase.aiAnalysisStatus.state === 'pending') {
      updatedCase.aiAnalysisStatus = { 
        ...updatedCase.aiAnalysisStatus, 
        state: 'completed', 
        riskScore: Math.floor(Math.random() * 40) + 10,
        analysisId: `ai-sim-${Date.now()}`
      };
    } else if (updatedCase.identityProofingStatus.state !== 'completed') {
      updatedCase.identityProofingStatus = { 
        state: 'completed', 
        completedChecks: ['identity_verified', 'credential_screened'],
        verifiedAt: new Date().toISOString()
      };
    } else if (updatedCase.humanReviewStatus.state === 'pending') {
      updatedCase.humanReviewStatus = { state: 'in_progress' };
    }
    
    set({ currentCase: updatedCase });
  },
}));
