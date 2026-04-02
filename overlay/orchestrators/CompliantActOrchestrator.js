const ActContext = require("../models/ActContext");
const HumanCommissionedNotaryProvider = require("../authority/human/HumanCommissionedNotaryProvider");
const AutonomousAuthorityProvider = require("../authority/autonomous/AutonomousAuthorityProvider");
const PolicyEngine = require("../policy/PolicyEngine");
const HumanSupervisionGate = require("../gates/HumanSupervisionGate");
const EvidenceBundleService = require("../evidence/EvidenceBundleService");
const EventRecorder = require("../evidence/EventRecorder");
const EventTypes = require("../evidence/EventTypes");
const ProtocolPublicationService = require("../services/ProtocolPublicationService");
const SignerIntakeService = require("../ron/SignerIntakeService");
const DocumentIntakeService = require("../ron/DocumentIntakeService");
const IdentityProofingService = require("../ron/IdentityProofingService");
const AIAnalysisService = require("../ron/AIAnalysisService");
const HumanReviewService = require("../ron/HumanReviewService");
const CeremonyService = require("../ron/CeremonyService");
const FinalizationService = require("../ron/FinalizationService");
const { createId, nowIso } = require("../utils/validation");

class CompliantActOrchestrator {
  constructor(options = {}) {
    this.config = options.config;
    this.eventRecorder = options.eventRecorder || new EventRecorder();
    this.policyEngine = options.policyEngine || new PolicyEngine({ config: this.config });
    this.humanSupervisionGate = options.humanSupervisionGate || new HumanSupervisionGate(this.config);
    this.authorityProviders = options.authorityProviders || {
      human_commissioned: new HumanCommissionedNotaryProvider(),
      autonomous: new AutonomousAuthorityProvider(),
    };
    this.evidenceBundleService =
      options.evidenceBundleService || new EvidenceBundleService({ outputRoot: this.config.EVIDENCE_OUTPUT_DIR });
    this.protocolPublicationService =
      options.protocolPublicationService ||
      new ProtocolPublicationService({
        config: this.config,
        eventRecorder: this.eventRecorder,
        eventTypes: EventTypes,
      });
    this.signerIntakeService = options.signerIntakeService || new SignerIntakeService();
    this.documentIntakeService = options.documentIntakeService || new DocumentIntakeService();
    this.identityProofingService = options.identityProofingService || new IdentityProofingService();
    this.aiAnalysisService = options.aiAnalysisService || new AIAnalysisService();
    this.humanReviewService = options.humanReviewService || new HumanReviewService();
    this.ceremonyService = options.ceremonyService || new CeremonyService();
    this.finalizationService = options.finalizationService || new FinalizationService();
  }

  async run(input) {
    const signer = this.signerIntakeService.intake(input.signer);
    const document = this.documentIntakeService.intake(input.document);
    const context = new ActContext({
      actId: input.actId || createId("act"),
      documentId: document.documentId,
      documentHash: document.documentHash,
      actType: input.actType || "notarization",
      documentType: document.documentType,
      jurisdiction: input.jurisdiction,
      signer,
      signerLocation: input.signerLocation,
      authorityLocation: input.authorityLocation,
      requestedAuthorityMode: input.requestedAuthorityMode || this.config.AUTHORITY_PROVIDER,
      activeAuthorityProvider: this.config.AUTHORITY_PROVIDER,
      legalMode: this.config.LEGAL_MODE,
      identityProofingStatus: { state: "pending", completedChecks: [] },
      aiAnalysisStatus: { state: "pending", reviewed: false },
      humanReviewStatus: { state: "pending", finalApproval: false },
      ceremonyStatus: { state: "pending", confirmedAt: null },
      policyDecisionId: null,
      evidenceBundleId: null,
      timestamps: {
        createdAt: nowIso(),
      },
    });

    const provider = this.authorityProviders[this.config.AUTHORITY_PROVIDER];
    this.humanSupervisionGate.assertCompliantProvider(context);

    const aiAnalysis = await this.aiAnalysisService.analyze(context, input.aiAnalysis);
    context.aiAnalysisStatus = {
      state: "completed",
      analysisId: aiAnalysis.analysisId,
      reviewed: false,
      riskScore: aiAnalysis.riskScore,
      fraudSignals: aiAnalysis.fraudSignals,
    };
    this.eventRecorder.record(EventTypes.AI_ANALYSIS_COMPLETED, {
      actId: context.actId,
      analysisId: aiAnalysis.analysisId,
      riskScore: aiAnalysis.riskScore,
    });

    const identityProofingStatus = await this.identityProofingService.verify(context, input.identityProofing);
    context.identityProofingStatus = identityProofingStatus;

    const policyDecision = this.policyEngine.evaluate(context);
    context.policyDecisionId = policyDecision.decisionId;
    this.eventRecorder.record(EventTypes.POLICY_DECISION_ISSUED, {
      actId: context.actId,
      decisionId: policyDecision.decisionId,
      allowed: policyDecision.allowed,
      blockReason: policyDecision.blockReason,
    });

    if (!policyDecision.allowed) {
      this.eventRecorder.record(EventTypes.FINALIZATION_BLOCKED, {
        actId: context.actId,
        reason: policyDecision.blockReason,
      });
      return {
        status: "blocked",
        context,
        policyDecision,
        aiAnalysis,
        events: this.eventRecorder.list(),
      };
    }

    const reviewSession = this.humanReviewService.openReview(context, aiAnalysis);
    this.eventRecorder.record(EventTypes.HUMAN_REVIEW_OPENED, reviewSession);

    let humanReview = null;
    let authorityExecution = null;
    let ceremonyRecord = null;

    try {
      humanReview = this.humanReviewService.completeReview(context, aiAnalysis, input.review);
      context.aiAnalysisStatus.reviewed = true;
      context.humanReviewStatus = {
        state: humanReview.finalRefusal ? "refused" : "completed",
        reviewId: humanReview.reviewId,
        finalApproval: humanReview.finalApproval,
      };
      this.eventRecorder.record(EventTypes.HUMAN_REVIEW_COMPLETED, {
        actId: context.actId,
        reviewId: humanReview.reviewId,
        decision: humanReview.decision,
        finalApproval: humanReview.finalApproval,
        finalRefusal: humanReview.finalRefusal,
      });

      this.humanSupervisionGate.assertCeremonyAllowed(context, policyDecision);
      const ceremonyOutcome = this.ceremonyService.complete(context, humanReview, provider, input.ceremony);
      ceremonyRecord = ceremonyOutcome.ceremonyRecord || null;
      context.ceremonyStatus = {
        state: ceremonyOutcome.state,
        confirmedAt: ceremonyOutcome.confirmedAt,
        ceremonyId: ceremonyRecord ? ceremonyRecord.ceremonyId : null,
        artifactRef: ceremonyRecord ? ceremonyRecord.artifactRef : null,
      };
      if (ceremonyOutcome.state === "completed") {
        this.eventRecorder.record(EventTypes.CEREMONY_COMPLETED, {
          actId: context.actId,
          providerType: ceremonyOutcome.providerType,
          confirmedAt: ceremonyOutcome.confirmedAt,
          ceremonyId: ceremonyRecord.ceremonyId,
          artifactRef: ceremonyRecord.artifactRef,
        });
      }

      if (humanReview.finalRefusal || humanReview.decision === "refuse") {
        const refusalRecord = provider.refuseAct(context, "human_refusal", humanReview);
        const refusalBundle = this.evidenceBundleService.createBundle(
          context,
          policyDecision,
          aiAnalysis,
          humanReview,
          ceremonyRecord,
          refusalRecord,
          () => this.eventRecorder.list()
        );
        context.evidenceBundleId = refusalBundle.bundleId;
        this.eventRecorder.record(EventTypes.ACT_REFUSED, {
          actId: context.actId,
          reviewId: humanReview.reviewId,
        });
        this.evidenceBundleService.exportBundle(refusalBundle.bundleId, "json");
        return {
          status: "refused",
          context,
          policyDecision,
          aiAnalysis,
          humanReview,
          authorityExecution: refusalRecord,
          evidenceBundle: refusalBundle,
          events: this.eventRecorder.list(),
        };
      }

      authorityExecution = provider.authorizeAct(context, policyDecision, humanReview);
      this.eventRecorder.record(EventTypes.ACT_AUTHORIZED, {
        actId: context.actId,
        executionId: authorityExecution.executionId,
        providerType: authorityExecution.providerType,
      });

      const producedArtifacts = this.evidenceBundleService.previewArtifacts(
        context,
        policyDecision,
        aiAnalysis,
        humanReview,
        ceremonyRecord,
        authorityExecution,
        () => this.eventRecorder.list()
      );

      this.humanSupervisionGate.assertFinalizationAllowed(
        context,
        policyDecision,
        humanReview,
        authorityExecution,
        producedArtifacts
      );

      authorityExecution = this.finalizationService.finalize(context, provider, authorityExecution);
      this.eventRecorder.record(EventTypes.CERTIFICATE_COMPLETED, {
        actId: context.actId,
        executionId: authorityExecution.executionId,
      });
      this.eventRecorder.record(EventTypes.FINAL_RECORD_SIGNED, {
        actId: context.actId,
        executionId: authorityExecution.executionId,
      });
    } catch (error) {
      this.eventRecorder.record(EventTypes.FINALIZATION_BLOCKED, {
        actId: context.actId,
        reason: error.message,
      });
      const blockedBundle = this.evidenceBundleService.createBundle(
        context,
        policyDecision,
        aiAnalysis,
        humanReview,
        ceremonyRecord,
        authorityExecution,
        () => this.eventRecorder.list()
      );
      context.evidenceBundleId = blockedBundle.bundleId;
      this.evidenceBundleService.exportBundle(blockedBundle.bundleId, "json");
      return {
        status: "blocked",
        error: error.message,
        context,
        policyDecision,
        aiAnalysis,
        humanReview,
        authorityExecution,
        evidenceBundle: blockedBundle,
        events: this.eventRecorder.list(),
      };
    }

    const evidenceBundle = this.evidenceBundleService.createBundle(
      context,
      policyDecision,
      aiAnalysis,
      humanReview,
      ceremonyRecord,
      authorityExecution,
      () => this.eventRecorder.list()
    );
    context.evidenceBundleId = evidenceBundle.bundleId;
    this.eventRecorder.record(EventTypes.EVIDENCE_BUNDLE_CREATED, {
      actId: context.actId,
      bundleId: evidenceBundle.bundleId,
    });

    authorityExecution = await this.protocolPublicationService.publish(
      context,
      authorityExecution,
      evidenceBundle
    );
    const exportResult = this.evidenceBundleService.exportBundle(evidenceBundle.bundleId, "json");

    return {
      status:
        authorityExecution.publicationStatus === "failed" &&
        this.config.PROTOCOL_PUBLICATION_MODE !== "disabled"
          ? "completed_with_publication_failure"
          : "completed",
      context,
      policyDecision,
      aiAnalysis,
      humanReview,
      authorityExecution,
      evidenceBundle,
      exportResult,
      events: this.eventRecorder.list(),
    };
  }
}

module.exports = CompliantActOrchestrator;
