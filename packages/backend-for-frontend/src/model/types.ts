import { agreementApi, bffApi, catalogApi } from "pagopa-interop-api-clients";
import { z } from "zod";

export const Conditions = z.object({
  AudienceRestriction: z
    .array(z.object({ Audience: z.array(z.string()) }))
    .refine((a) => a.length > 0, { message: "Missing " }),
  NotBefore: z.string(),
  NotOnOrAfter: z.string(),
});
export type Conditions = z.infer<typeof Conditions>;

export const SAMLResponse = z
  .object({
    Response: z.object({
      Issuer: z.string(),
      Signature: z.object({
        SignedInfo: z.object({
          CanonicalizationMethod: z.object({ Algorithm: z.string() }),
          SignatureMethod: z.object({ Algorithm: z.string() }),
          Reference: z.object({
            Transforms: z.object({
              Transform: z.array(z.object({ Algorithm: z.string() })),
            }),
            DigestMethod: z.object({ Algorithm: z.string() }),
            DigestValue: z.string(),
            URI: z.string(),
          }),
        }),
        SignatureValue: z.string(),
        KeyInfo: z.object({
          X509Data: z.object({
            X509SubjectName: z.string(),
            X509Certificate: z.string(),
          }),
        }),
      }),
      Status: z.object({ StatusCode: z.object({ Value: z.string() }) }),
      Assertion: z
        .array(
          z.object({
            Issuer: z.string(),
            Subject: z.object({
              NameID: z.object({ "#text": z.string(), Format: z.string() }),
              SubjectConfirmation: z.object({
                SubjectConfirmationData: z.object({
                  NotOnOrAfter: z.string(),
                  Recipient: z.string(),
                }),
                Method: z.string(),
              }),
            }),
            Conditions,
            AttributeStatement: z.object({
              Attribute: z.object({
                AttributeValue: z.array(
                  z.object({
                    "#text": z.string(),
                    type: z.string(),
                  })
                ),
                Name: z.string(),
              }),
            }),
            AuthnStatement: z.object({
              AuthnContext: z.object({ AuthnContextClassRef: z.string() }),
              AuthnInstant: z.string(),
              SessionIndex: z.string(),
            }),
            ID: z.string(),
            IssueInstant: z.string(),
            Version: z.string(),
          })
        )
        .nonempty({ message: "Missing Assertions" }),
      Destination: z.string(),
      ID: z.string(),
      IssueInstant: z.string(),
      Version: z.string(),
    }),
  })
  .deepPartial();

export type SAMLResponse = z.infer<typeof SAMLResponse>;

export const PrivacyNoticeVersion = z.object({
  versionId: z.string(),
  name: z.string(),
  publishedDate: z.string(),
  status: z.string(),
  version: z.number(),
});
export type PrivacyNoticeVersion = z.infer<typeof PrivacyNoticeVersion>;

export const PrivacyNotice = z.object({
  privacyNoticeId: z.string(),
  createdDate: z.string(),
  lastPublishedDate: z.string(),
  organizationId: z.string(),
  responsibleUserId: z.string().optional(),
  privacyNoticeVersion: PrivacyNoticeVersion,
  persistedAt: z.string(),
});
export type PrivacyNotice = z.infer<typeof PrivacyNotice>;

export const UserPrivacyNoticeConsentTypePP = z.object({
  PP: z.literal("PP"),
});
export type UserPrivacyNoticeConsentTypePP = z.infer<
  typeof UserPrivacyNoticeConsentTypePP
>;

export const UserPrivacyNoticeConsentTypeTOS = z.object({
  TOS: z.literal("TOS"),
});
export type UserPrivacyNoticeConsentTypeTOS = z.infer<
  typeof UserPrivacyNoticeConsentTypeTOS
>;

export const UserPrivacyNoticeConsentType = UserPrivacyNoticeConsentTypePP.or(
  UserPrivacyNoticeConsentTypeTOS
);
export type UserPrivacyNoticeConsentType = z.infer<
  typeof UserPrivacyNoticeConsentType
>;

export const UserPrivacyNoticeVersion = z.object({
  versionId: z.string(),
  kind: UserPrivacyNoticeConsentType,
  version: z.number(),
});
export type UserPrivacyNoticeVersion = z.infer<typeof UserPrivacyNoticeVersion>;

export const UserPrivacyNotice = z.object({
  pnIdWithUserId: z.string(),
  versionNumber: z.number(),
  privacyNoticeId: z.string(),
  userId: z.string(),
  acceptedAt: z.string(),
  version: UserPrivacyNoticeVersion,
});
export type UserPrivacyNotice = z.infer<typeof UserPrivacyNotice>;

export const catalogApiDescriptorState =
  catalogApi.EServiceDescriptorState.Values;

export const agreementApiState = agreementApi.AgreementState.Values;

export const EserviceConsumer = z.object({
  descriptorVersion: z.number(),
  descriptorState: catalogApi.EServiceDescriptorState,
  agreementState: agreementApi.AgreementState,
  consumerName: z.string(),
  consumerExternalId: z.string(),
});

export const ConfigurationSingleAnswer = z.object({
  key: z.string(),
  value: z.string().nullable().optional(),
});
export type ConfigurationSingleAnswer = z.infer<
  typeof ConfigurationSingleAnswer
>;

export const ConfigurationMultiAnswer = z.object({
  key: z.string(),
  values: z.array(z.string()),
});
export type ConfigurationMultiAnswer = z.infer<typeof ConfigurationMultiAnswer>;

const ConfigurationRiskAnalysisForm = z.object({
  version: z.string(),
  singleAnswers: z.array(ConfigurationSingleAnswer),
  multiAnswers: z.array(ConfigurationMultiAnswer),
});

export const ConfigurationRiskAnalysis = z.object({
  name: z.string(),
  riskAnalysisForm: ConfigurationRiskAnalysisForm,
});

export type ConfigurationRiskAnalysis = z.infer<
  typeof ConfigurationRiskAnalysis
>;

export const ConfigurationDoc = z.object({
  prettyName: z.string(),
  path: z.string(),
});
export type ConfigurationDoc = z.infer<typeof ConfigurationDoc>;

export const ConfigurationDescriptor = z.object({
  interface: ConfigurationDoc.optional(),
  docs: z.array(ConfigurationDoc),
  audience: z.array(z.string()),
  voucherLifespan: z.number(),
  dailyCallsPerConsumer: z.number(),
  dailyCallsTotal: z.number(),
  description: z.string().optional(),
  agreementApprovalPolicy: bffApi.AgreementApprovalPolicy,
});

export const ConfigurationEservice = z.object({
  name: z.string(),
  description: z.string(),
  technology: bffApi.EServiceTechnology,
  mode: bffApi.EServiceMode,
  descriptor: ConfigurationDescriptor,
  riskAnalysis: z.array(ConfigurationRiskAnalysis),
  isSignalHubEnabled: z.boolean().optional(),
  isDelegable: z.boolean().optional(),
  isClientAccessDelegable: z.boolean().optional(),
});
export type ConfigurationEservice = z.infer<typeof ConfigurationEservice>;
