class PolicyEngine {
  evaluate() {
    throw new Error("PolicyEngine.evaluate must be implemented");
  }

  getPolicy() {
    throw new Error("PolicyEngine.getPolicy must be implemented");
  }

  validatePolicySet() {
    throw new Error("PolicyEngine.validatePolicySet must be implemented");
  }
}

module.exports = PolicyEngine;
