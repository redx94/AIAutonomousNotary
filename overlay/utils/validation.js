const { randomUUID } = require("crypto");

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new ValidationError(message);
  }
}

function validateObject(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function validateString(value, label, options = {}) {
  const { allowNull = false, allowEmpty = false } = options;

  if (value === null && allowNull) {
    return value;
  }

  assert(typeof value === "string", `${label} must be a string`);
  if (!allowEmpty) {
    assert(value.trim().length > 0, `${label} must not be empty`);
  }
  return value;
}

function validateBoolean(value, label) {
  assert(typeof value === "boolean", `${label} must be a boolean`);
  return value;
}

function validateNumber(value, label, options = {}) {
  const { min = null, max = null } = options;
  assert(typeof value === "number" && Number.isFinite(value), `${label} must be a finite number`);
  if (min !== null) {
    assert(value >= min, `${label} must be >= ${min}`);
  }
  if (max !== null) {
    assert(value <= max, `${label} must be <= ${max}`);
  }
  return value;
}

function validateArray(value, label, options = {}) {
  const { minLength = 0 } = options;
  assert(Array.isArray(value), `${label} must be an array`);
  assert(value.length >= minLength, `${label} must contain at least ${minLength} item(s)`);
  return value;
}

function validateStringArray(value, label, options = {}) {
  validateArray(value, label, options).forEach((item, index) => {
    validateString(item, `${label}[${index}]`);
  });
  return value;
}

function validateEnum(value, label, allowedValues) {
  validateString(value, label);
  assert(allowedValues.includes(value), `${label} must be one of: ${allowedValues.join(", ")}`);
  return value;
}

function validateTimestamp(value, label) {
  validateString(value, label);
  assert(!Number.isNaN(Date.parse(value)), `${label} must be an ISO-8601 timestamp`);
  return value;
}

function validateOptional(value, validator) {
  if (value === undefined) {
    return undefined;
  }
  return validator(value);
}

function validateStatusObject(value, label) {
  const status = validateObject(value, label);
  validateString(status.state, `${label}.state`);
  if (status.completedChecks !== undefined) {
    validateStringArray(status.completedChecks, `${label}.completedChecks`);
  }
  if (status.analysisId !== undefined) {
    validateString(status.analysisId, `${label}.analysisId`);
  }
  if (status.reviewId !== undefined) {
    validateString(status.reviewId, `${label}.reviewId`);
  }
  if (status.confirmedAt !== undefined && status.confirmedAt !== null) {
    validateTimestamp(status.confirmedAt, `${label}.confirmedAt`);
  }
  if (status.finalApproval !== undefined) {
    validateBoolean(status.finalApproval, `${label}.finalApproval`);
  }
  if (status.reviewed !== undefined) {
    validateBoolean(status.reviewed, `${label}.reviewed`);
  }
  if (status.verifiedAt !== undefined && status.verifiedAt !== null) {
    validateTimestamp(status.verifiedAt, `${label}.verifiedAt`);
  }
  return status;
}

function validateSigner(value, label) {
  const signer = validateObject(value, label);
  validateString(signer.signerId, `${label}.signerId`);
  validateString(signer.displayName, `${label}.displayName`);
  validateString(signer.email, `${label}.email`);
  return signer;
}

function validateTimestamps(value, label) {
  const timestamps = validateObject(value, label);
  Object.entries(timestamps).forEach(([key, entry]) => {
    validateTimestamp(entry, `${label}.${key}`);
  });
  return timestamps;
}

function validatePlainObjectMap(value, label) {
  const objectValue = validateObject(value, label);
  Object.entries(objectValue).forEach(([key, entry]) => {
    assert(typeof key === "string", `${label} keys must be strings`);
    assert(
      ["string", "number", "boolean", "object"].includes(typeof entry) || entry === null,
      `${label}.${key} must be a JSON-serializable value`
    );
  });
  return objectValue;
}

function createId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  ValidationError,
  assert,
  createId,
  nowIso,
  validateArray,
  validateBoolean,
  validateEnum,
  validateNumber,
  validateObject,
  validateOptional,
  validatePlainObjectMap,
  validateSigner,
  validateStatusObject,
  validateString,
  validateStringArray,
  validateTimestamp,
  validateTimestamps,
};
