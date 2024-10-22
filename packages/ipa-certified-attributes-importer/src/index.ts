import { createHash } from "crypto";
import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  logger,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { attributeRegistryApi, tenantApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { Attribute, ORIGIN_IPA, Tenant } from "pagopa-interop-models";
import { config } from "./config/config.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "./services/readModelService.js";
import {
  InternalCertifiedAttribute,
  RegistryData,
  getRegistryData,
  kindToBeExcluded,
} from "./services/openDataService.js";

export type TenantSeed = {
  origin: string;
  originId: string;
  description: string;
  attributes: Array<{ origin: string; code: string }>;
};

type Header = {
  "X-Correlation-Id": string;
  Authorization: string;
};

const loggerInstance = logger({
  serviceName: "ipa-certified-attributes-importer",
  correlationId: uuidv4(),
});

function toKey<T>(a: T): string {
  return JSON.stringify(a);
}

async function checkAttributesPresence(
  readModelService: ReadModelService,
  newAttributes: attributeRegistryApi.InternalCertifiedAttributeSeed[]
): Promise<boolean> {
  const attributes = await readModelService.getAttributes();

  const certifiedAttributeIndex = new Map(
    attributes
      .filter((a) => a.kind === "Certified" && a.origin && a.code)
      .map((a) => [toKey({ origin: a.origin, code: a.code }), a])
  );

  const missingAttributes = newAttributes.filter(
    (i) =>
      !certifiedAttributeIndex.get(toKey({ origin: i.origin, code: i.code }))
  );

  return missingAttributes.length === 0;
}

export function getTenantUpsertData(
  registryData: RegistryData,
  platformTenant: Tenant[]
): TenantSeed[] {
  // get a set with the external id of all tenants that have a selfcareId
  const platformTenantIndex = new Set(
    platformTenant.map((t) => toKey(t.externalId))
  );

  // filter the institutions open data retrieving only the tenants
  // that are already present in the platform
  const institutionAlreadyPresent = registryData.institutions.filter(
    (i) =>
      i.id.length > 0 &&
      platformTenantIndex.has(toKey({ origin: i.origin, value: i.originId }))
  );

  // get a set with the attributes that should be created
  return institutionAlreadyPresent.map((i) => {
    const attributesWithoutKind = match(i.classification)
      .with("Agency", () => [
        {
          origin: i.origin,
          code: i.category,
        },
        {
          origin: i.origin,
          code: i.originId,
        },
      ])
      .otherwise(() => [
        {
          origin: i.origin,
          code: i.category,
        },
      ]);

    const shouldKindBeExcluded = kindToBeExcluded.has(i.kind);

    const attributes = shouldKindBeExcluded
      ? attributesWithoutKind
      : [
          {
            origin: i.origin,
            code: createHash("sha256").update(i.kind).digest("hex"),
          },
          ...attributesWithoutKind,
        ];

    return {
      origin: i.origin,
      originId: i.originId,
      description: i.description,
      attributes,
    };
  });
}

async function createNewAttributes(
  newAttributes: InternalCertifiedAttribute[],
  readModelService: ReadModelService,
  headers: Header
): Promise<void> {
  const client = attributeRegistryApi.createAttributeApiClient(
    config.attributeRegistryUrl
  );

  for (const attribute of newAttributes) {
    await client.createInternalCertifiedAttribute(attribute, {
      headers,
    });
  }

  // wait untill every event reach the read model store
  do {
    await new Promise((r) => setTimeout(r, config.attributeCreationWaitTime));
  } while (!(await checkAttributesPresence(readModelService, newAttributes)));
}

export function getNewAttributes(
  registryData: RegistryData,
  tenantUpsertData: TenantSeed[],
  attributes: Attribute[]
): InternalCertifiedAttribute[] {
  // get a set with all the certified attributes in the platform
  const platformAttributeIndex = new Set(
    attributes
      .filter((a) => a.kind === "Certified" && a.origin && a.code)
      .map((a) => toKey({ origin: a.origin, code: a.code }))
  );

  const newAttributesIndex = new Set(
    tenantUpsertData.flatMap((t) =>
      t.attributes.map((a) => toKey({ origin: a.origin, code: a.code }))
    )
  );

  return registryData.attributes.filter(
    (a) =>
      newAttributesIndex.has(toKey({ origin: a.origin, code: a.code })) &&
      !platformAttributeIndex.has(toKey({ origin: a.origin, code: a.code }))
  );
}

export async function getAttributesToAssign(
  platformTenant: Tenant[],
  platformAttributes: Attribute[],
  tenantSeed: TenantSeed[]
): Promise<tenantApi.InternalTenantSeed[]> {
  const tenantIndex = new Map(
    platformTenant.map((t) => [toKey(t.externalId), t])
  );

  const certifiedAttribute = new Map(
    platformAttributes
      .filter((a) => a.kind === "Certified" && a.origin && a.code)
      .map((a) => [a.id, a])
  );

  return tenantSeed
    .map((i) => {
      const externalId = { origin: i.origin, value: i.originId };

      const tenant = tenantIndex.get(toKey(externalId));

      if (!tenant) {
        return undefined;
      }

      const tenantCurrentAttribute = new Map(
        tenant.attributes
          .map((a) => {
            const withRevocation = match(a)
              .with({ type: "PersistentCertifiedAttribute" }, (certified) => ({
                ...a,
                revocationTimestamp: certified.revocationTimestamp,
              }))
              .otherwise((_) => undefined);

            if (withRevocation) {
              const attribute = certifiedAttribute.get(withRevocation.id);

              if (attribute) {
                return {
                  ...attribute,
                  revocationTimestamp: withRevocation.revocationTimestamp,
                };
              }
            }

            return undefined;
          })
          .filter((a) => a !== undefined)
          .map((a) => [toKey({ origin: a?.origin, code: a?.code }), a])
      );

      return tenant
        ? {
            externalId,
            name: tenant.name,
            certifiedAttributes: i.attributes
              .filter((a) => {
                const attribute = tenantCurrentAttribute.get(
                  toKey({
                    origin: a.origin,
                    code: a.code,
                  })
                );

                if (!attribute) {
                  return true;
                }

                return attribute.revocationTimestamp !== undefined;
              })
              .map((a) => ({
                origin: a.origin,
                code: a.code,
              })),
          }
        : undefined;
    })
    .filter(
      (t) => t !== undefined && t.certifiedAttributes.length > 0
    ) as tenantApi.InternalTenantSeed[];
}

async function assignNewAttribute(
  attributesToAssign: tenantApi.InternalTenantSeed[],
  headers: Header
): Promise<void> {
  const tenantClient = tenantApi.createInternalApiClient(
    config.tenantProcessUrl
  );

  for (const attributeToAssign of attributesToAssign) {
    await tenantClient.internalUpsertTenant(attributeToAssign, { headers });
  }
}

export async function getAttributesToRevoke(
  registryData: RegistryData,
  tenantSeed: TenantSeed[],
  platformTenants: Tenant[],
  platformAttributes: Attribute[]
): Promise<
  Array<{
    tOrigin: string;
    tExtenalId: string;
    aOrigin: string;
    aCode: string;
  }>
> {
  const indexFromOpenData = new Set(
    registryData.attributes.map((a) =>
      toKey({ origin: a.origin, value: a.code })
    )
  );

  const tenantSeedIndex = new Map(
    tenantSeed.map((t) => [
      toKey({ origin: t.origin, value: t.originId }),
      new Set(
        t.attributes.map((a) => toKey({ origin: a.origin, value: a.code }))
      ),
    ])
  );

  const certifiedAttribute = new Map(
    platformAttributes
      .filter((a) => a.kind === "Certified" && a.origin && a.code)
      .map((a) => [a.id, a])
  );

  const canBeRevoked = (
    attribute: {
      origin: string;
      code: string;
    },
    tenantExternalId: { origin: string; value: string }
  ): boolean => {
    const externalId = { origin: attribute.origin, value: attribute.code };

    if (attribute.origin !== ORIGIN_IPA) {
      return false;
    }

    const registryAttributes = tenantSeedIndex.get(toKey(tenantExternalId));
    if (!registryAttributes) {
      return false;
    }

    if (registryAttributes.has(toKey(externalId))) {
      return false;
    }

    return !indexFromOpenData.has(toKey(externalId));
  };

  return platformTenants.flatMap((t) =>
    t.attributes
      // eslint-disable-next-line sonarjs/no-identical-functions
      .map((a) => {
        const withRevocation = match(a)
          .with({ type: "PersistentCertifiedAttribute" }, (certified) => ({
            ...a,
            revocationTimestamp: certified.revocationTimestamp,
          }))
          .otherwise((_) => undefined);

        if (withRevocation) {
          const attribute = certifiedAttribute.get(withRevocation.id);

          if (attribute) {
            return {
              ...attribute,
              revocationTimestamp: withRevocation.revocationTimestamp,
            };
          }
        }

        return undefined;
      })
      .filter(
        (a) =>
          a !== undefined &&
          a.revocationTimestamp === undefined &&
          a.origin &&
          a.code &&
          canBeRevoked(
            {
              origin: a.origin,
              code: a.code,
            },
            t.externalId
          )
      )
      .map((a) => ({
        tOrigin: t.externalId.origin,
        tExtenalId: t.externalId.value,
        aOrigin: a?.origin as string,
        aCode: a?.code as string,
      }))
  );
}

async function revokeAttributes(
  attributesToRevoke: Array<{
    tOrigin: string;
    tExtenalId: string;
    aOrigin: string;
    aCode: string;
  }>,
  headers: Header
): Promise<void> {
  const tenantClient = tenantApi.createInternalApiClient(
    config.tenantProcessUrl
  );

  for (const a of attributesToRevoke) {
    await tenantClient.internalRevokeCertifiedAttribute(undefined, {
      params: {
        tOrigin: a.tOrigin,
        tExternalId: a.tExtenalId,
        aOrigin: a.aOrigin,
        aExternalId: a.aCode,
      },
      headers,
    });
  }
}

async function getHeader(
  refreshableToken: RefreshableInteropToken,
  correlationId: string
): Promise<Header> {
  const token = (await refreshableToken.get()).serialized;

  return {
    "X-Correlation-Id": correlationId,
    Authorization: `Bearer ${token}`,
  };
}

loggerInstance.info("Starting ipa-certified-attributes-importer");

try {
  const correlatsionId = uuidv4();

  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );

  const tokenGenerator = new InteropTokenGenerator(config);
  const refreshableToken = new RefreshableInteropToken(tokenGenerator);
  await refreshableToken.init();

  loggerInstance.info("Getting registry data");

  const registryData = await getRegistryData();

  const attributes = await readModelService.getAttributes();
  const ipaTenants = await readModelService.getIPATenants();

  const tenantUpsertData = getTenantUpsertData(registryData, ipaTenants);

  const newAttributes = getNewAttributes(
    registryData,
    tenantUpsertData,
    attributes
  );

  await createNewAttributes(
    newAttributes,
    readModelService,
    await getHeader(refreshableToken, correlatsionId)
  );

  const attributesToAssign = await getAttributesToAssign(
    ipaTenants,
    attributes,
    tenantUpsertData
  );

  await assignNewAttribute(
    attributesToAssign,
    await getHeader(refreshableToken, correlatsionId)
  );

  const attributesToRevoke = await getAttributesToRevoke(
    registryData,
    tenantUpsertData,
    ipaTenants,
    attributes
  );

  await revokeAttributes(
    attributesToRevoke,
    await getHeader(refreshableToken, correlatsionId)
  );
} catch (error) {
  loggerInstance.error(error);
}
