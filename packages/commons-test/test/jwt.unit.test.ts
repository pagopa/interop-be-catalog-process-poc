/* eslint-disable functional/immutable-data */
import { readAuthDataFromJwtToken } from "pagopa-interop-commons";
import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { randomArrayItem } from "../src/testUtils.js";

const mockUiToken = {
  iss: "dev.interop.pagopa.it",
  externalId: {
    origin: "IPA",
    value: "5N2TR557",
  },
  "user-roles": "security,api",
  selfcareId: "1962d21c-c701-4805-93f6-53a877898756",
  organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
  aud: "dev.interop.pagopa.it/ui,dev.interop.pagopa.it/fake",
  uid: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
  nbf: 1710841859,
  organization: {
    id: "1962d21c-c701-4805-93f6-53a877898756",
    name: "PagoPA S.p.A.",
    roles: [
      {
        partyRole: "MANAGER",
        role: "admin",
      },
    ],
    fiscal_code: "15376371009",
    ipaCode: "5N2TR557",
  },
  name: "Mario",
  exp: 1710928259,
  iat: 1710841859,
  family_name: "Rossi",
  jti: "e82bd774-9cac-4885-931b-015b2eb4e9a5",
  email: "m.rossi@psp.it",
};

const mockM2MToken = {
  organizationId: "89804b2c-f62e-4867-87a4-3a82f2b03485",
  aud: "refactor.dev.interop.pagopa.it/m2m,refactor.dev.interop.pagopa.it/fake",
  sub: "227cadc9-1a2c-4612-b100-a247b48d0464",
  role: "m2m",
  nbf: 1710511524,
  iss: "refactor.dev.interop.pagopa.it",
  exp: 1810511523,
  iat: 1710511524,
  client_id: "227cadc9-1a2c-4612-b100-a247b48d0464",
  jti: "d0c42cfb-8a32-430f-95cf-085067b52695",
};

const mockInternalToken = {
  aud: "refactor.dev.interop.pagopa.it/m2m,refactor.dev.interop.pagopa.it/fake",
  sub: "227cadc9-1a2c-4612-b100-a247b48d0464",
  role: "internal",
  nbf: 1710511524,
  iss: "refactor.dev.interop.pagopa.it",
  exp: 1810511523,
  iat: 1710511524,
  jti: "d0c42cfb-8a32-430f-95cf-085067b52695",
};

const mockSupportToken = {
  iss: "refactor.dev.interop.pagopa.it",
  externalId: {
    origin: "IPA",
    value: "5N2TR557",
  },
  "user-roles": "support",
  selfcareId: "1962d21c-c701-4805-93f6-53a877898756",
  organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
  aud: "dev.interop.pagopa.it/ui,dev.interop.pagopa.it/fake",
  uid: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
  nbf: 1710841859,
  organization: {
    roles: [
      {
        role: "support",
      },
    ],
    id: "1962d21c-c701-4805-93f6-53a877898756",
    name: "PagoPA S.p.A.",
  },
  exp: 1710928259,
  iat: 1710841859,
  jti: "e82bd774-9cac-4885-931b-015b2eb4e9a5",
};

const getMockSignedToken = (token: object): string =>
  jwt.sign(token, "test-secret");

const parseReadAuthDataFromJwtTokenErrorResult = (result: Error): string =>
  JSON.parse(result.message)[0].message;

describe("JWT tests", () => {
  describe("readAuthDataFromJwtToken", () => {
    it("should successfully read auth data from a UI token with a single user role", async () => {
      const token = getMockSignedToken({
        ...mockUiToken,
        "user-roles": "admin",
      });
      expect(readAuthDataFromJwtToken(token)).toEqual({
        externalId: {
          origin: "IPA",
          value: "5N2TR557",
        },
        selfcareId: "1962d21c-c701-4805-93f6-53a877898756",
        organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
        userId: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
        userRoles: ["admin"],
      });
    });

    it("should successfully read auth data from a UI token with multiple comma separated user roles", async () => {
      const token = getMockSignedToken({
        ...mockUiToken,
        "user-roles": "security,api",
      });

      expect(readAuthDataFromJwtToken(token)).toEqual({
        externalId: {
          origin: "IPA",
          value: "5N2TR557",
        },
        selfcareId: "1962d21c-c701-4805-93f6-53a877898756",
        organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
        userId: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
        userRoles: ["security", "api"],
      });
    });

    it("should fail reading auth data from a UI token with invalid user roles", async () => {
      const token = getMockSignedToken({
        ...mockUiToken,
        "user-roles": "api,invalid-role",
      });

      const result = readAuthDataFromJwtToken(token);
      expect(result).toBeInstanceOf(Error);
      expect(parseReadAuthDataFromJwtTokenErrorResult(result as Error)).toEqual(
        "Invalid enum value. Expected 'admin' | 'security' | 'api' | 'support', received 'invalid-role'"
      );
    });

    it("should fail reading auth data from a UI token with empty user roles", async () => {
      const token = getMockSignedToken({
        ...mockUiToken,
        "user-roles": "",
      });

      const result = readAuthDataFromJwtToken(token);
      expect(readAuthDataFromJwtToken(token)).toBeInstanceOf(Error);
      expect(parseReadAuthDataFromJwtTokenErrorResult(result as Error)).toEqual(
        "String must contain at least 1 character(s)"
      );
    });

    it("should successfully read auth data from a M2M token", async () => {
      const token = getMockSignedToken(mockM2MToken);
      expect(readAuthDataFromJwtToken(token)).toEqual({
        externalId: {
          origin: "",
          value: "",
        },
        organizationId: "89804b2c-f62e-4867-87a4-3a82f2b03485",
        selfcareId: "",
        userId: "",
        userRoles: ["m2m"],
      });
    });

    it("should fail if some required fields are missing", () => {
      const mockToken = randomArrayItem([
        mockUiToken,
        mockM2MToken,
        mockInternalToken,
      ]);
      const token = getMockSignedToken({
        ...mockToken,
        sub: undefined,
        jti: undefined,
      });

      const result = readAuthDataFromJwtToken(token);
      expect(result).toBeInstanceOf(Error);
      expect(parseReadAuthDataFromJwtTokenErrorResult(result as Error)).toEqual(
        "Required"
      );
    });

    it("should fail if the aud field is an empty string", () => {
      const mockToken = randomArrayItem([
        mockUiToken,
        mockM2MToken,
        mockInternalToken,
      ]);
      const token = getMockSignedToken({
        ...mockToken,
        aud: "",
      });

      const result = readAuthDataFromJwtToken(token);
      expect(result).toBeInstanceOf(Error);
      expect(parseReadAuthDataFromJwtTokenErrorResult(result as Error)).toEqual(
        "String must contain at least 1 character(s)"
      );
    });

    it("should successfully read auth data from an Internal token", async () => {
      const token = getMockSignedToken(mockInternalToken);
      expect(readAuthDataFromJwtToken(token)).toEqual({
        externalId: {
          origin: "",
          value: "",
        },
        organizationId: "",
        selfcareId: "",
        userId: "",
        userRoles: ["internal"],
      });
    });

    it("should fail when the token is invalid", async () => {
      const token = getMockSignedToken({
        role: "invalid-role",
      });

      const result = readAuthDataFromJwtToken(token);
      expect(result).toBeInstanceOf(Error);
      expect(parseReadAuthDataFromJwtTokenErrorResult(result as Error)).toEqual(
        "Invalid discriminator value. Expected 'm2m' | 'internal' | "
      );
    });

    it("should successfully read auth data from a Support token", async () => {
      const token = getMockSignedToken(mockSupportToken);
      expect(readAuthDataFromJwtToken(token)).toEqual({
        externalId: {
          origin: "IPA",
          value: "5N2TR557",
        },
        organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
        userId: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
        userRoles: ["support"],
      });
    });

    it("should fail reading auth data from a Support token with invalid user roles", async () => {
      const token = getMockSignedToken({
        ...mockSupportToken,
        "user-roles": "support,invalid-role",
      });

      const result = readAuthDataFromJwtToken(token);
      expect(result).toBeInstanceOf(Error);
      expect(parseReadAuthDataFromJwtTokenErrorResult(result as Error)).toEqual(
        "Invalid enum value. Expected 'admin' | 'security' | 'api' | 'support', received 'invalid-role'"
      );
    });
  });
});
