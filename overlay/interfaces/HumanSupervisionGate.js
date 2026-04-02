class HumanSupervisionGate {
  assertFinalizationAllowed() {
    throw new Error("HumanSupervisionGate.assertFinalizationAllowed must be implemented");
  }

  assertCeremonyAllowed() {
    throw new Error("HumanSupervisionGate.assertCeremonyAllowed must be implemented");
  }

  assertCompliantProvider() {
    throw new Error("HumanSupervisionGate.assertCompliantProvider must be implemented");
  }
}

module.exports = HumanSupervisionGate;
