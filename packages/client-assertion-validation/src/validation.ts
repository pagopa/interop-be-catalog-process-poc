import {
  decode,
  JsonWebTokenError,
  JwtPayload,
  NotBeforeError,
  TokenExpiredError,
  verify,
} from "jsonwebtoken";
import { match } from "ts-pattern";
import { clientKindTokenStates } from "pagopa-interop-models";
import {
  failedValidation,
  successfulValidation,
  EXPECTED_CLIENT_ASSERTION_TYPE,
  EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE,
  validateJti,
  validateAlgorithm,
  validateAudience,
  validateDigest,
  validateExp,
  validateIat,
  validateIss,
  validateKid,
  validatePurposeId,
  validateSub,
  validatePlatformState,
} from "./utils.js";
import {
  ApiKey,
  ClientAssertion,
  ClientAssertionValidationRequest,
  ConsumerKey,
  Key,
  ValidationResult,
} from "./types.js";
import {
  clientAssertionSignatureVerificationFailure,
  invalidAssertionType,
  invalidClientAssertionFormat,
  invalidClientAssertionSignatureType,
  invalidGrantType,
  jsonWebTokenError,
  notBeforeError,
  purposeIdNotProvided,
  tokenExpiredError,
  unexpectedClientAssertionPayload,
} from "./errors.js";

export const validateRequestParameters = (
  request: ClientAssertionValidationRequest
): ValidationResult<ClientAssertionValidationRequest> => {
  const assertionTypeError =
    request.client_assertion_type !== EXPECTED_CLIENT_ASSERTION_TYPE
      ? invalidAssertionType(request.client_assertion_type)
      : undefined;

  const grantTypeError =
    request.grant_type !== EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE
      ? invalidGrantType(request.grant_type)
      : undefined;

  if (!assertionTypeError && !grantTypeError) {
    return successfulValidation(request);
  }
  return failedValidation([assertionTypeError, grantTypeError]);
};

// eslint-disable-next-line complexity
export const verifyClientAssertion = (
  clientAssertionJws: string,
  clientId: string | undefined
): ValidationResult<ClientAssertion> => {
  try {
    const decoded = decode(clientAssertionJws, { complete: true, json: true });
    if (!decoded) {
      return failedValidation([invalidClientAssertionFormat()]);
    }

    if (typeof decoded.payload === "string") {
      return failedValidation([unexpectedClientAssertionPayload()]);
    }

    const { errors: jtiErrors, data: validatedJti } = validateJti(
      decoded.payload.jti
    );
    const { errors: iatErrors, data: validatedIat } = validateIat(
      decoded.payload.iat
    );
    const { errors: expErrors, data: validatedExp } = validateExp(
      decoded.payload.exp
    );
    const { errors: issErrors, data: validatedIss } = validateIss(
      decoded.payload.iss
    );
    const { errors: subErrors, data: validatedSub } = validateSub(
      decoded.payload.sub,
      clientId
    );
    const { errors: purposeIdErrors, data: validatedPurposeId } =
      validatePurposeId(decoded.payload.purposeId);
    const { errors: kidErrors, data: validatedKid } = validateKid(
      decoded.header.kid
    );
    const { errors: audErrors, data: validatedAud } = validateAudience(
      decoded.payload.aud
    );
    const { errors: algErrors, data: validatedAlg } = validateAlgorithm(
      decoded.header.alg
    );
    const { errors: digestErrors, data: validatedDigest } = validateDigest(
      decoded.payload.digest
    );
    if (
      !jtiErrors &&
      !iatErrors &&
      !expErrors &&
      !issErrors &&
      !subErrors &&
      !purposeIdErrors &&
      !kidErrors &&
      !audErrors &&
      !algErrors &&
      !digestErrors
    ) {
      const result: ClientAssertion = {
        header: {
          kid: validatedKid,
          alg: validatedAlg,
        },
        payload: {
          sub: validatedSub,
          purposeId: validatedPurposeId,
          jti: validatedJti,
          iat: validatedIat,
          iss: validatedIss,
          aud: validatedAud,
          exp: validatedExp,
          digest: validatedDigest,
        },
      };
      return successfulValidation(result);
    }
    return failedValidation([
      jtiErrors,
      iatErrors,
      expErrors,
      issErrors,
      subErrors,
      purposeIdErrors,
      kidErrors,
      audErrors,
      algErrors,
      digestErrors,
    ]);
  } catch (error) {
    return failedValidation([unexpectedClientAssertionPayload()]);
  }
};

export const verifyClientAssertionSignature = (
  clientAssertionJws: string,
  key: Key
): ValidationResult<JwtPayload> => {
  try {
    const result = verify(clientAssertionJws, key.publicKey, {
      algorithms: [key.algorithm],
    });

    // TODO: no idea when result is a string
    if (typeof result === "string") {
      return failedValidation([
        invalidClientAssertionSignatureType(typeof result),
      ]);
    }
    return successfulValidation(result);
  } catch (error: unknown) {
    if (error instanceof TokenExpiredError) {
      return failedValidation([tokenExpiredError()]);
    } else if (error instanceof NotBeforeError) {
      return failedValidation([notBeforeError()]);
    } else if (error instanceof JsonWebTokenError) {
      // TODO: this might overlap with invalidClientAssertionFormat raised inside verifyClientAssertion
      return failedValidation([jsonWebTokenError(error.message)]);
    } else {
      return failedValidation([clientAssertionSignatureVerificationFailure()]);
    }
  }
};

export const validateClientKindAndPlatformState = (
  key: ApiKey | ConsumerKey,
  jwt: ClientAssertion
): ValidationResult<ClientAssertion> =>
  match(key.clientKind)
    .with(clientKindTokenStates.api, () => successfulValidation(jwt))
    .with(clientKindTokenStates.consumer, () => {
      const { errors: platformStateErrors } = validatePlatformState(
        key as ConsumerKey
      );
      const purposeIdError = jwt.payload.purposeId
        ? undefined
        : purposeIdNotProvided();

      if (!platformStateErrors && !purposeIdError) {
        return successfulValidation(jwt);
      }
      return failedValidation([platformStateErrors, purposeIdError]);
    })
    .exhaustive();
