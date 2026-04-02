import type { FC } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { useCaseStore } from './store/useCaseStore';
import type { UserRole } from './types';

// Signer Screens
import { SignerHome } from './screens/signer/SignerHome';
import { DocumentIntake } from './screens/signer/DocumentIntake';
import { AIFindings } from './screens/signer/AIFindings';
import { IdentityProofing } from './screens/signer/IdentityProofing';
import { CaseDetail } from './screens/signer/CaseDetail';
import { SessionPrep } from './screens/signer/SessionPrep';
import { LiveSession } from './screens/signer/LiveSession';
import { FinalPackage } from './screens/signer/FinalPackage';

// Notary Screens
import { NotaryQueue } from './screens/notary/NotaryQueue';
import { NotaryCaseReview } from './screens/notary/NotaryCaseReview';

// Compliance Screens
import { CaseLedger } from './screens/compliance/CaseLedger';
import { ComplianceCaseDetail } from './screens/compliance/ComplianceCaseDetail';
import { EvidenceExplorer } from './screens/compliance/EvidenceExplorer';
import { PolicyRules } from './screens/compliance/PolicyRules';
import { PublicationOps } from './screens/compliance/PublicationOps';

// Verifier Screens
import { VerificationPortal } from './screens/verifier/VerificationPortal';

const App: FC = () => {
  const { currentRole, setRole } = useCaseStore();
  
  // Route configuration based on role
  const getDefaultRoute = (role: UserRole) => {
    switch (role) {
      case 'signer': return '/signer';
      case 'notary': return '/notary';
      case 'compliance': return '/compliance';
      case 'verifier': return '/verify';
      default: return '/signer';
    }
  };
  
  return (
    <BrowserRouter>
      <Layout currentRole={currentRole} onRoleChange={setRole}>
        <Routes>
          {/* Signer Routes */}
          <Route path="/signer" element={<SignerHome />} />
          <Route path="/signer/upload" element={<DocumentIntake />} />
          <Route path="/signer/ai-findings" element={<AIFindings />} />
          <Route path="/signer/identity" element={<IdentityProofing />} />
          <Route path="/signer/case/:caseId" element={<CaseDetail />} />
          <Route path="/signer/case" element={<CaseDetail />} />
          <Route path="/signer/session-prep" element={<SessionPrep />} />
          <Route path="/signer/session" element={<LiveSession />} />
          <Route path="/signer/final" element={<FinalPackage />} />
          
          {/* Notary Routes */}
          <Route path="/notary" element={<NotaryQueue />} />
          <Route path="/notary/cases" element={<NotaryQueue />} />
          <Route path="/notary/case/:caseId" element={<NotaryCaseReview />} />
          <Route path="/notary/case" element={<NotaryCaseReview />} />
          
          {/* Compliance Routes */}
          <Route path="/compliance" element={<CaseLedger />} />
          <Route path="/compliance/case/:caseId" element={<ComplianceCaseDetail />} />
          <Route path="/compliance/evidence/:bundleId" element={<EvidenceExplorer />} />
          <Route path="/compliance/policies" element={<PolicyRules />} />
          <Route path="/compliance/publication/:caseId" element={<PublicationOps />} />
          
          {/* Verifier Routes */}
          <Route path="/verify" element={<VerificationPortal />} />
          <Route path="/verify/:caseId" element={<VerificationPortal />} />
          
          {/* Default Redirect */}
          <Route path="/" element={<Navigate to={getDefaultRoute(currentRole)} replace />} />
          <Route path="*" element={<Navigate to={getDefaultRoute(currentRole)} replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
