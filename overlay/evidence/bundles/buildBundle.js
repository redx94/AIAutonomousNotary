const path = require("path");
const EvidenceBundleManifest = require("../../models/EvidenceBundleManifest");
const { hashJson } = require("../../utils/hash");
const { createId, nowIso } = require("../../utils/validation");

function buildBundle({
  context,
  policyDecision,
  aiAnalysis,
  humanReview,
  ceremonyRecord,
  authorityExecution,
  events,
  bundleId = createId("bundle"),
}) {
  const eventLog = typeof events === "function" ? events() : events;
  const policySnapshot = policyDecision ? policyDecision.toJSON() : null;
  const aiSnapshot = aiAnalysis ? aiAnalysis.toJSON() : null;
  const reviewSnapshot = humanReview ? humanReview.toJSON() : null;
  const ceremonySnapshot = ceremonyRecord ? ceremonyRecord.toJSON() : null;
  const authoritySnapshot = authorityExecution ? authorityExecution.toJSON() : null;
  const publicationSnapshot = authorityExecution
    ? {
        publicationAttempted: authorityExecution.publicationAttempted,
        publicationMode: authorityExecution.publicationMode,
        publicationStatus: authorityExecution.publicationStatus,
        publicationTxHashes: authorityExecution.publicationTxHashes,
        publicationErrors: authorityExecution.publicationErrors,
        publishedArtifacts: authorityExecution.publishedArtifacts,
      }
    : null;

  const sections = {
    "events.json": eventLog,
    "retention-policy.json": policySnapshot ? policySnapshot.retentionPolicy : {},
    "evidence-index.json": {
      eventLog: "events.json",
      recordingMetadata: policySnapshot ? policySnapshot.recordingPolicy : {},
      certificateMetadata: authoritySnapshot
        ? {
            certificateCompleted: authoritySnapshot.certificateCompleted,
            finalRecordSigned: authoritySnapshot.finalRecordSigned,
          }
        : {},
    },
  };

  if (policySnapshot) {
    sections["policy-decision.json"] = policySnapshot;
    sections["evidence-index.json"].policyDecisionRecord = "policy-decision.json";
  }
  if (aiSnapshot) {
    sections["ai-analysis.json"] = aiSnapshot;
    sections["evidence-index.json"].aiAnalysisRecord = "ai-analysis.json";
  }
  if (reviewSnapshot) {
    sections["human-review.json"] = reviewSnapshot;
    sections["evidence-index.json"].humanReviewRecord = "human-review.json";
  }
  if (ceremonySnapshot) {
    sections["ceremony-record.json"] = ceremonySnapshot;
    sections["evidence-index.json"].ceremonyRecord = "ceremony-record.json";
  }
  if (authoritySnapshot) {
    sections["authority-execution.json"] = authoritySnapshot;
    sections["evidence-index.json"].legalAuthorityRecord = "authority-execution.json";
  }
  if (publicationSnapshot) {
    sections["protocol-publication.json"] = publicationSnapshot;
    sections["evidence-index.json"].protocolPublicationRecord = "protocol-publication.json";
  }

  const hashIndex = Object.entries(sections).reduce((accumulator, [fileName, content]) => {
    accumulator[fileName] = hashJson(content || {});
    return accumulator;
  }, {});
  hashIndex["context.json"] = hashJson(context.toJSON());

  sections["hashes.json"] = hashIndex;

  const manifest = new EvidenceBundleManifest({
    bundleId,
    actId: context.actId,
    includedArtifacts: [
      "manifest.json",
      ...Object.keys(sections),
    ],
    hashIndex,
    retentionPolicy: policySnapshot ? policySnapshot.retentionPolicy : {},
    exportFormatVersion: "compliance-overlay-v2",
    createdAt: nowIso(),
  });

  return {
    bundleId,
    directoryName: path.join(context.actId, bundleId),
    manifest,
    sections,
  };
}

module.exports = buildBundle;
