class FinalizationService {
  finalize(context, provider, authorityExecution) {
    const certificate = provider.completeCertificate(context);
    const finalRecord = provider.signFinalRecord(context);

    authorityExecution.certificateCompleted = true;
    authorityExecution.finalRecordSigned = true;
    authorityExecution.certificateMetadata = certificate;
    authorityExecution.finalRecordMetadata = finalRecord;

    return authorityExecution;
  }
}

module.exports = FinalizationService;
