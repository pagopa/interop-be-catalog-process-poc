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
  digestClaimNotFound,
  invalidDigestFormat,
  invalidHashLength,
  invalidHashAlgorithm,
  invalidKidFormat,
} from "./errors.js";
import { config } from "./config.js";

export const EXPECTED_CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"; // TODO: env?
export const EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE = "client_credentials"; // TODO: env?
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
  // TODO requires refactor
  sub?: string,
  clientId?: string
): ValidationResult<string> => {
  if (!sub) {
    return failedValidation([subjectNotFound()]);
  }
  if (clientId) {
    const clientIdError = !ClientId.safeParse(clientId).success
      ? invalidClientIdFormat(clientId)
      : undefined;
    const invalidSubFormatError = !ClientId.safeParse(sub).success
      ? invalidSubjectFormat(sub)
      : undefined;
    if (clientIdError || invalidSubFormatError) {
      return failedValidation([clientIdError, invalidSubFormatError]);
    }
    // TODO: clientId undefined OK?
    if (sub !== clientId) {
      return failedValidation([invalidSubject(sub)]);
    }
  }
  return successfulValidation(sub);
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
  const alphanumericRegex = new RegExp("^[a-zA-Z0-9]+$");
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
  // TODO requires refactor
  digest?: object
): ValidationResult<ClientAssertionDigest> => {
  if (!digest) {
    return failedValidation([digestClaimNotFound()]);
  }
  const result = ClientAssertionDigest.safeParse(digest);
  if (!result.success) {
    return failedValidation([invalidDigestFormat()]);
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
  // TODO requires refactor
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
});

export const failedValidation = (
  errors: Array<ApiError<ErrorCodes> | undefined>
): FailedValidation => ({
  errors: errors.filter((v): v is NonNullable<typeof v> => Boolean(v)),
});
