import {
  ApiError,
  ClientId,
  itemState,
  PurposeId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  ClientAssertionDigest,
  ConsumerKey,
  FailedValidation,
  ValidationResult,
  SuccessfulValidation,
} from "./types.js";
import {
  ErrorCodes,
  expNotFound,
  issuedAtNotFound,
  invalidAudience,
  invalidAudienceFormat,
  issuerNotFound,
  jtiNotFound,
  subjectNotFound,
  invalidSubject,
  invalidPurposeIdClaimFormat,
  kidNotFound,
  inactiveAgreement,
  inactiveEService,
  inactivePurpose,
  invalidClientIdFormat,
  invalidSubjectFormat,
  algorithmNotFound,
  algorithmNotAllowed,
  invalidHashLength,
  invalidHashAlgorithm,
  invalidKidFormat,
  digestClaimNotFound,
} from "./errors.js";
import { config } from "./config.js";

export const EXPECTED_CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
export const EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE = "client_credentials";
export const ALLOWED_ALGORITHM = "RS256";
const ALLOWED_DIGEST_ALGORITHM = "SHA256";

export const validateJti = (jti?: string): ValidationResult<string> => {
  if (!jti) {
    return failedValidation([jtiNotFound()]);
  }

  return successfulValidation(jti);
};

export const validateIat = (iat?: number): ValidationResult<number> => {
  if (!iat) {
    return failedValidation([issuedAtNotFound()]);
  }

  return successfulValidation(iat);
};

export const validateExp = (exp?: number): ValidationResult<number> => {
  if (!exp) {
    return failedValidation([expNotFound()]);
  }
  return successfulValidation(exp);
};

export const validateIss = (iss?: string): ValidationResult<string> => {
  if (!iss) {
    return failedValidation([issuerNotFound()]);
  }

  return successfulValidation(iss);
};

export const validateSub = (
  sub?: string,
  clientId?: string
): ValidationResult<ClientId> => {
  if (!sub) {
    return failedValidation([subjectNotFound()]);
  }

  if (!ClientId.safeParse(sub).success) {
    return failedValidation([invalidSubjectFormat(sub)]);
  }
  if (clientId) {
    if (!ClientId.safeParse(clientId).success) {
      return failedValidation([invalidClientIdFormat(clientId)]);
    }
    if (sub !== clientId) {
      return failedValidation([invalidSubject(sub)]);
    }
  }
  return successfulValidation(unsafeBrandId<ClientId>(sub));
};

export const validatePurposeId = (
  purposeId?: string
): ValidationResult<PurposeId | undefined> => {
  if (purposeId && !PurposeId.safeParse(purposeId).success) {
    return failedValidation([invalidPurposeIdClaimFormat(purposeId)]);
  }
  const validatedPurposeId = purposeId
    ? unsafeBrandId<PurposeId>(purposeId)
    : undefined;
  return successfulValidation(validatedPurposeId);
};

export const validateKid = (kid?: string): ValidationResult<string> => {
  if (!kid) {
    return failedValidation([kidNotFound()]);
  }

  const alphanumericRegex = new RegExp("^[a-zA-Z0-9-_]+$");
  if (alphanumericRegex.test(kid)) {
    return successfulValidation(kid);
  }
  return failedValidation([invalidKidFormat()]);
};

export const validateAudience = (
  aud: string | string[] | undefined
): ValidationResult<string[]> => {
  if (aud === config.clientAssertionAudience) {
    return successfulValidation([aud]);
  }

  if (!Array.isArray(aud)) {
    return failedValidation([invalidAudienceFormat()]);
  }
  if (!aud.includes(config.clientAssertionAudience)) {
    return failedValidation([invalidAudience()]);
  }
  return successfulValidation(aud);
};

export const validateAlgorithm = (alg?: string): ValidationResult<string> => {
  if (!alg) {
    return failedValidation([algorithmNotFound()]);
  }

  if (alg === ALLOWED_ALGORITHM) {
    return successfulValidation(alg);
  }
  return failedValidation([algorithmNotAllowed(alg)]);
};

export const validateDigest = (
  digest?: object
): ValidationResult<ClientAssertionDigest | undefined> => {
  if (!digest) {
    return successfulValidation(digest);
  }
  const result = ClientAssertionDigest.safeParse(digest);
  if (!result.success) {
    return failedValidation([digestClaimNotFound(result.error.toString())]);
  }
  const validatedDigest = result.data;
  const digestLengthError =
    validatedDigest.value.length !== 64
      ? invalidHashLength(validatedDigest.alg)
      : undefined;
  const digestAlgError =
    validatedDigest.alg !== ALLOWED_DIGEST_ALGORITHM
      ? invalidHashAlgorithm()
      : undefined;
  if (!digestLengthError && !digestAlgError) {
    return successfulValidation(result.data);
  }
  return failedValidation([digestLengthError, digestAlgError]);
};

export const validatePlatformState = (
  key: ConsumerKey
): ValidationResult<ConsumerKey> => {
  const agreementError =
    key.agreementState !== itemState.active ? inactiveAgreement() : undefined;

  const descriptorError =
    key.descriptorState !== itemState.active ? inactiveEService() : undefined;

  const purposeError =
    key.purposeState !== itemState.active ? inactivePurpose() : undefined;

  if (!agreementError && !descriptorError && !purposeError) {
    return successfulValidation(key);
  }
  return failedValidation([agreementError, descriptorError, purposeError]);
};

export const successfulValidation = <T>(
  result: T
): SuccessfulValidation<T> => ({
  data: result,
  errors: undefined,
});

export const failedValidation = (
  // errors: [[error1, error2, undefined], error3, undefined]
  errors: Array<
    Array<ApiError<ErrorCodes> | undefined> | ApiError<ErrorCodes> | undefined
  >
): FailedValidation<ErrorCodes> => {
  const nestedArrayWithoutUndefined = errors.filter((a) => a !== undefined);
  const flattenedArray = nestedArrayWithoutUndefined.flat(1);
  const flattenedArrayWithoutUndefined = flattenedArray.filter(
    (e) => e !== undefined
  );
  return {
    data: undefined,
    errors: flattenedArrayWithoutUndefined as Array<ApiError<ErrorCodes>>,
  };
};
