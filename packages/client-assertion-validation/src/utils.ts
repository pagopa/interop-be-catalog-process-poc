import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  decode,
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError,
  verify,
} from "jsonwebtoken";
import {
  ApiError,
  ClientId,
  clientKind,
  PurposeId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  ApiKey,
  ClientAssertion,
  ClientAssertionDigest,
  ConsumerKey,
  FlexibleValidationResult,
  Key,
  ValidationResult,
} from "./types.js";
import {
  ErrorCodes,
  expNotFound,
  issuedAtNotFound,
  invalidAssertionType,
  invalidAudience,
  invalidAudienceFormat,
  invalidClientAssertionFormat,
  invalidGrantType,
  issuerNotFound,
  jtiNotFound,
  subjectNotFound,
  unexpectedClientAssertionPayload,
  invalidSubject,
  invalidPurposeIdClaimFormat,
  kidNotFound,
  inactiveAgreement,
  inactiveEService,
  inactivePurpose,
  tokenExpiredError,
  jsonWebTokenError,
  notBeforeError,
  clientAssertionSignatureVerificationFailure,
  invalidClientAssertionSignatureType,
  invalidClientIdFormat,
  invalidSubjectFormat,
  algorithmNotFound,
  algorithmNotAllowed,
  digestClaimNotFound,
  invalidDigestFormat,
  invalidHashLength,
  invalidHashAlgorithm,
  invalidKidFormat,
  unexpectedKeyType,
} from "./errors.js";
const CLIENT_ASSERTION_AUDIENCE = "test.interop.pagopa.it"; // TODO: env?
const EXPECTED_CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"; // TODO: env?
const EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE = "client_credentials"; // TODO: env?
const ALLOWED_ALGORITHM = "RS256";
const ALLOWED_DIGEST_ALGORITHM = "SHA256";

export const validateRequestParameters = (
  request: authorizationServerApi.AccessTokenRequest
): Array<ApiError<ErrorCodes>> | undefined => {
  const assertionTypeError =
    request.client_assertion_type !== EXPECTED_CLIENT_ASSERTION_TYPE
      ? invalidAssertionType(request.client_assertion_type)
      : undefined;

  // TODO: this might be useless because authorizationServerApi.AccessTokenRequest has the string hard coded
  const grantTypeError =
    request.grant_type !== EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE
      ? invalidGrantType(request.grant_type)
      : undefined;

  if (!assertionTypeError && !grantTypeError) {
    return undefined;
  }
  return [assertionTypeError, grantTypeError].filter((e) => e !== undefined);
};

const validateJti = (jti?: string): FlexibleValidationResult<string> => {
  if (!jti) {
    return {
      errors: [jtiNotFound()],
      data: undefined,
    };
  } else {
    return {
      errors: undefined,
      data: jti,
    };
  }
};

const validateIat = (iat?: number): FlexibleValidationResult<number> => {
  if (!iat) {
    return {
      errors: [issuedAtNotFound()],
      data: undefined,
    };
  } else {
    return {
      errors: undefined,
      data: iat,
    };
  }
};

const validateExp = (exp?: number): FlexibleValidationResult<number> => {
  if (!exp) {
    return {
      errors: [expNotFound()],
      data: undefined,
    };
  } else {
    return {
      errors: undefined,
      data: exp,
    };
  }
};

const validateIss = (iss?: string): FlexibleValidationResult<string> => {
  if (!iss) {
    return {
      errors: [issuerNotFound()],
      data: undefined,
    };
  } else {
    return {
      errors: undefined,
      data: iss,
    };
  }
};

const validateSub = (
  sub?: string,
  clientId?: string
): FlexibleValidationResult<string> => {
  if (!sub) {
    return {
      errors: [subjectNotFound()],
      data: undefined,
    };
  }
  if (clientId) {
    const clientIdError = !ClientId.safeParse(clientId).success
      ? invalidClientIdFormat(clientId)
      : undefined;
    const invalidSubFormatError = !ClientId.safeParse(sub).success
      ? invalidSubjectFormat(sub)
      : undefined;
    if (clientIdError || invalidSubFormatError) {
      return {
        errors: [clientIdError, invalidSubFormatError].filter(
          (e) => e !== undefined
        ),
        data: undefined,
      };
    }
    // TODO: clientId undefined OK?
    if (sub !== clientId) {
      return {
        errors: [invalidSubject(sub)],
        data: undefined,
      };
    }
  }
  return {
    errors: undefined,
    data: sub,
  };
};

const validatePurposeId = (
  purposeId?: string
): FlexibleValidationResult<PurposeId | undefined> => {
  if (purposeId && !PurposeId.safeParse(purposeId).success) {
    return {
      errors: [invalidPurposeIdClaimFormat(purposeId)],
      data: undefined,
    };
  } else {
    return {
      errors: undefined,
      data: purposeId ? unsafeBrandId<PurposeId>(purposeId) : undefined,
    };
  }
};

const validateKid = (kid?: string): FlexibleValidationResult<string> => {
  if (!kid) {
    return {
      errors: [kidNotFound()],
      data: undefined,
    };
  }
  const alphanumericRegex = new RegExp("^[a-zA-Z0-9]+$");
  if (alphanumericRegex.test(kid)) {
    return {
      errors: undefined,
      data: kid,
    };
  }
  return {
    errors: [invalidKidFormat()],
    data: undefined,
  };
};

const validateAudience = (
  aud: string | string[] | undefined
): FlexibleValidationResult<string[]> => {
  if (aud === CLIENT_ASSERTION_AUDIENCE) {
    return { errors: undefined, data: [aud] };
  }

  if (!Array.isArray(aud)) {
    return {
      errors: [invalidAudienceFormat()],
      data: undefined,
    };
  } else {
    if (!aud.includes(CLIENT_ASSERTION_AUDIENCE)) {
      return { errors: [invalidAudience()], data: undefined };
    }
    return { errors: undefined, data: aud };
  }
};

const validateAlgorithm = (alg?: string): FlexibleValidationResult<string> => {
  if (!alg) {
    return {
      errors: [algorithmNotFound()],
      data: undefined,
    };
  }
  if (alg === ALLOWED_ALGORITHM) {
    return {
      errors: undefined,
      data: alg,
    };
  }
  return {
    errors: [algorithmNotAllowed(alg)],
    data: undefined,
  };
};

const validateDigest = (
  digest?: object
): FlexibleValidationResult<ClientAssertionDigest> => {
  if (!digest) {
    return {
      errors: [digestClaimNotFound()],
      data: undefined,
    };
  }
  const result = ClientAssertionDigest.safeParse(digest);
  if (!result.success) {
    return {
      errors: [invalidDigestFormat()],
      data: undefined,
    };
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
    return {
      errors: undefined,
      data: result.data,
    };
  }
  return {
    errors: [digestLengthError, digestAlgError].filter((e) => e !== undefined),
    data: undefined,
  };
};

// eslint-disable-next-line complexity
export const verifyClientAssertion = (
  clientAssertionJws: string,
  clientId: string | undefined
): ValidationResult => {
  try {
    const decoded = decode(clientAssertionJws, { complete: true, json: true });
    if (!decoded) {
      return { errors: [invalidClientAssertionFormat()], data: undefined };
    }

    if (typeof decoded.payload === "string") {
      return { errors: [unexpectedClientAssertionPayload()], data: undefined };
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
      return { errors: undefined, data: result };
    }
    return {
      errors: [
        ...(jtiErrors || []),
        ...(iatErrors || []),
        ...(expErrors || []),
        ...(issErrors || []),
        ...(subErrors || []),
        ...(purposeIdErrors || []),
        ...(kidErrors || []),
        ...(audErrors || []),
        ...(algErrors || []),
        ...(digestErrors || []),
      ],
      data: undefined,
    };
  } catch (error) {
    return { errors: [unexpectedClientAssertionPayload()], data: undefined };
  }
};

// export const b64Decode = (str: string): string =>
//   Buffer.from(str, "base64").toString("binary");

export const verifyClientAssertionSignature = (
  clientAssertionJws: string,
  key: Key
): Array<ApiError<ErrorCodes>> | undefined => {
  try {
    const result = verify(clientAssertionJws, key.publicKey, {
      algorithms: [key.algorithm],
    });

    // TODO: no idea when result is a string
    if (typeof result === "string") {
      return [invalidClientAssertionSignatureType(typeof result)];
    } else {
      return undefined;
    }
  } catch (error: unknown) {
    if (error instanceof TokenExpiredError) {
      return [tokenExpiredError()];
    } else if (error instanceof NotBeforeError) {
      return [notBeforeError()];
    } else if (error instanceof JsonWebTokenError) {
      // TODO: this might overlap with invalidClientAssertionFormat raised inside verifyClientAssertion
      return [jsonWebTokenError(error.message)];
    } else {
      return [clientAssertionSignatureVerificationFailure()];
    }
  }
};

export const validatePlatformState = (
  key: ConsumerKey
): Array<ApiError<ErrorCodes>> => {
  const agreementError =
    key.agreementState !== "ACTIVE" ? inactiveAgreement() : undefined;

  const descriptorError =
    key.descriptorState !== "ACTIVE" ? inactiveEService() : undefined;

  const purposeError =
    key.purposeState !== "ACTIVE" ? inactivePurpose() : undefined;

  return [agreementError, descriptorError, purposeError].filter(
    (e) => e !== undefined
  );
};

export const validateClientKindAndPlatformState = (
  key: ApiKey,
  jwt: ClientAssertion
): ValidationResult =>
  match(key.clientKind)
    .with(clientKind.api, () => {
      console.log("key", key);
      console.log("safeParse", ApiKey.safeParse(key).success);
      return !ApiKey.safeParse(key).success
        ? { errors: [unexpectedKeyType(clientKind.api)], data: undefined }
        : { data: jwt, errors: undefined };
    })
    .with(clientKind.consumer, () => {
      if (ConsumerKey.safeParse(key).success) {
        const platformStateErrors = validatePlatformState(key as ConsumerKey);
        if (platformStateErrors.length === 0) {
          return { data: jwt, errors: undefined };
        }
        return { errors: platformStateErrors, data: undefined };
      }
      return {
        errors: [unexpectedKeyType(clientKind.consumer)],
        data: undefined,
      };
    })
    .exhaustive();
