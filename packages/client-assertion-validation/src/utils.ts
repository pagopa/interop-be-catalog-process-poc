import { authorizationServerApi } from "pagopa-interop-api-clients";
import {
  decode,
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError,
  verify,
} from "jsonwebtoken";
import { ApiError, PurposeId, unsafeBrandId } from "pagopa-interop-models";
import {
  ClientAssertion,
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
} from "./errors.js";
const CLIENT_ASSERTION_AUDIENCE = "test.interop.pagopa.it"; // To do: env?
const EXPECTED_CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"; // To do: env?
const EXPECTED_CLIENT_CREDENTIALS_GRANT_TYPE = "client_credentials"; // To do: env?

export const validateRequestParameters = (
  request: authorizationServerApi.AccessTokenRequest
): Array<ApiError<ErrorCodes>> | undefined => {
  const assertionTypeError =
    request.client_assertion_type !== EXPECTED_CLIENT_ASSERTION_TYPE
      ? invalidAssertionType(request.client_assertion_type)
      : undefined;

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
  } else {
    if (clientId && sub !== clientId) {
      // Todo add check on clientId as ClientId type
      return {
        errors: [invalidSubject()],
        data: undefined,
      };
    }
    return {
      errors: undefined,
      data: sub,
    };
  }
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
  } else {
    return {
      errors: undefined,
      data: kid,
    };
  }
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

export const verifyClientAssertion = (
  clientAssertionJws: string,
  clientId: string | undefined
): ValidationResult => {
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
    decoded.payload.iss,
    clientId
  );
  const { errors: purposeIdErrors, data: validatedPurposeId } =
    validatePurposeId(decoded.payload.purposeId);
  const { errors: kidErrors, data: validatedKid } = validateKid(
    decoded.payload.kid
  );
  const { errors: audErrors, data: validatedAud } = validateAudience(
    decoded.payload.aud
  );

  if (
    !jtiErrors &&
    !iatErrors &&
    !expErrors &&
    !issErrors &&
    !subErrors &&
    !purposeIdErrors &&
    !kidErrors &&
    !audErrors
  ) {
    const result: ClientAssertion = {
      header: {
        kid: validatedKid,
        alg: decoded.header.alg,
      },
      payload: {
        sub: validatedSub,
        purposeId: validatedPurposeId,
        jti: validatedJti,
        iat: validatedIat,
        iss: validatedIss,
        aud: validatedAud,
        exp: validatedExp, // TODO Check unit of measure
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
    ],
    data: undefined,
  };
};

export const b64Decode = (str: string): string =>
  Buffer.from(str, "base64").toString("binary");

export const verifyClientAssertionSignature = (
  clientAssertionJws: string,
  key: Key
): Array<ApiError<ErrorCodes>> | undefined => {
  // todo: should this return a JwtPayload? Probably not
  try {
    const result = verify(clientAssertionJws, b64Decode(key.publicKey), {
      algorithms: [key.algorithm],
    });

    // TODO Improve this
    if (typeof result === "string") {
      return [invalidClientAssertionSignatureType(typeof result)];
    } else {
      return undefined;
    }
  } catch (error: unknown) {
    if (error instanceof TokenExpiredError) {
      // eslint-disable-next-line no-console
      console.log("TokenExpiredError");
      return [tokenExpiredError()];
    } else if (error instanceof JsonWebTokenError) {
      // eslint-disable-next-line no-console
      console.log("JsonWebTokenError");
      return [jsonWebTokenError()];
    } else if (error instanceof NotBeforeError) {
      // eslint-disable-next-line no-console
      console.log("NotBeforeError");
      return [notBeforeError()];
    } else {
      // eslint-disable-next-line no-console
      console.log("unknown error");
      return [clientAssertionSignatureVerificationFailure()];
    }
  }
};

export const assertValidPlatformState = (
  key: ConsumerKey
): Array<ApiError<ErrorCodes>> => {
  // To do: is it ok to have these check throwing errors? So that they can be read if needed (instead of just getting false)
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
