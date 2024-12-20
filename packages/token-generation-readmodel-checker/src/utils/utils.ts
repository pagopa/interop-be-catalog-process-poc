import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementId,
  agreementState,
  AgreementState,
  Client,
  ClientId,
  clientKind,
  ClientKind,
  ClientKindTokenGenStates,
  clientKindTokenGenStates,
  Descriptor,
  DescriptorId,
  DescriptorState,
  descriptorState,
  EService,
  EServiceId,
  genericInternalError,
  GSIPKConsumerIdEServiceId,
  itemState,
  ItemState,
  makeGSIPKClientIdPurposeId,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  PlatformStatesAgreementEntry,
  PlatformStatesAgreementPK,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesClientPK,
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesPurposeEntry,
  PlatformStatesPurposePK,
  Purpose,
  PurposeId,
  PurposeVersion,
  purposeVersionState,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesGenericClient,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { config } from "../configs/config.js";
import {
  AgreementDifferencesResult,
  CatalogDifferencesResult,
  ClientDifferencesResult,
  ComparisonAgreement,
  ComparisonClient,
  ComparisonEService,
  ComparisonPlatformStatesAgreementEntry,
  ComparisonPlatformStatesCatalogEntry,
  ComparisonPlatformStatesClientEntry,
  ComparisonPlatformStatesPurposeEntry,
  ComparisonPurpose,
  ComparisonTokenGenStatesGenericClient,
  PurposeDifferencesResult,
} from "../models/types.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { tokenGenerationReadModelServiceBuilder } from "../services/tokenGenerationReadModelService.js";

export function getLastPurposeVersion(
  purposeVersions: PurposeVersion[]
): PurposeVersion {
  return purposeVersions
    .filter(
      (pv) =>
        pv.state === purposeVersionState.active ||
        pv.state === purposeVersionState.suspended ||
        pv.state === purposeVersionState.archived
    )
    .toSorted(
      (purposeVersion1, purposeVersion2) =>
        purposeVersion2.createdAt.getTime() -
        purposeVersion1.createdAt.getTime()
    )[0];
}

export function getLastAgreement(agreements: Agreement[]): Agreement {
  return agreements
    .filter(
      (a) =>
        a.state === agreementState.active ||
        a.state === agreementState.suspended
    )
    .toSorted(
      (agreement1, agreement2) =>
        agreement2.createdAt.getTime() - agreement1.createdAt.getTime()
    )[0];
}

export function getValidDescriptors(descriptors: Descriptor[]): Descriptor[] {
  return descriptors.filter(
    (descriptor) =>
      descriptor.state === descriptorState.published ||
      descriptor.state === descriptorState.suspended ||
      descriptor.state === descriptorState.deprecated
  );
}

function getIdFromPlatformStatesPK<
  T extends PurposeId | AgreementId | ClientId
>(
  pk:
    | PlatformStatesPurposePK
    | PlatformStatesAgreementPK
    | PlatformStatesClientPK
): T {
  return unsafeBrandId<T>(pk.split("#")[1]);
}

function getCatalogIdsFromPlatformStatesPK(
  pk: PlatformStatesEServiceDescriptorPK
): {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
} {
  const splitPK = pk.split("#");
  return {
    eserviceId: unsafeBrandId<EServiceId>(splitPK[1]),
    descriptorId: unsafeBrandId<DescriptorId>(splitPK[2]),
  };
}

function getClientIdFromTokenGenStatesPK(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): ClientId {
  const splitPK = pk.split("#");
  return unsafeBrandId<ClientId>(splitPK[1]);
}

function getKidFromTokenGenStatesPK(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): string {
  const splitPK = pk.split("#");
  return unsafeBrandId<ClientId>(splitPK[2]);
}

function getPurposeIdFromTokenGenStatesPK(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): PurposeId | undefined {
  const splitPK = pk.split("#");
  return unsafeBrandId<PurposeId>(splitPK[3]);
}

export async function compareTokenGenerationReadModel(
  dynamoDBClient: DynamoDBClient,
  logger: Logger
): Promise<number> {
  logger.info(
    "Token generation read model and read model comparison started.\n"
  );
  logger.info("> Connecting to database...");
  const readModel = ReadModelRepository.init(config);
  const readModelService = readModelServiceBuilder(readModel);
  logger.info("> Connected to database!\n");

  const tokenGenerationService =
    tokenGenerationReadModelServiceBuilder(dynamoDBClient);
  const platformStatesEntries =
    await tokenGenerationService.readAllPlatformStatesItems();
  const tokenGenerationStatesEntries =
    await tokenGenerationService.readAllTokenGenerationStatesItems();

  const tokenGenStatesByClient = tokenGenerationStatesEntries.reduce(
    (acc: Map<ClientId, TokenGenerationStatesGenericClient[]>, entry) => {
      const clientId = getClientIdFromTokenGenStatesPK(entry.PK);
      acc.set(clientId, [...(acc.get(clientId) || []), entry]);
      return acc;
    },
    new Map<ClientId, TokenGenerationStatesGenericClient[]>()
  );

  const platformStates: {
    purposes: Map<PurposeId, PlatformStatesPurposeEntry>;
    agreements: Map<AgreementId, PlatformStatesAgreementEntry>;
    eservices: Map<EServiceId, Map<DescriptorId, PlatformStatesCatalogEntry>>;
    clients: Map<ClientId, PlatformStatesClientEntry>;
  } = platformStatesEntries.reduce<{
    purposes: Map<PurposeId, PlatformStatesPurposeEntry>;
    agreements: Map<AgreementId, PlatformStatesAgreementEntry>;
    eservices: Map<EServiceId, Map<DescriptorId, PlatformStatesCatalogEntry>>;
    clients: Map<ClientId, PlatformStatesClientEntry>;
  }>(
    (acc, e) => {
      const parsedPurpose = PlatformStatesPurposeEntry.safeParse(e);
      if (parsedPurpose.success) {
        acc.purposes.set(
          unsafeBrandId<PurposeId>(
            getIdFromPlatformStatesPK(parsedPurpose.data.PK)
          ),
          parsedPurpose.data
        );
        return acc;
      }

      const parsedAgreement = PlatformStatesAgreementEntry.safeParse(e);
      if (parsedAgreement.success) {
        acc.agreements.set(
          unsafeBrandId<AgreementId>(
            getIdFromPlatformStatesPK(parsedAgreement.data.PK)
          ),
          parsedAgreement.data
        );
        return acc;
      }

      const parsedCatalog = PlatformStatesCatalogEntry.safeParse(e);
      if (parsedCatalog.success) {
        const catalogIds = getCatalogIdsFromPlatformStatesPK(
          parsedCatalog.data.PK
        );

        acc.eservices.set(
          catalogIds.eserviceId,
          (
            acc.eservices.get(catalogIds.eserviceId) ??
            new Map<DescriptorId, PlatformStatesCatalogEntry>()
          ).set(catalogIds.descriptorId, parsedCatalog.data)
        );

        return acc;
      }

      const parsedClient = PlatformStatesClientEntry.safeParse(e);
      if (parsedClient.success) {
        acc.clients.set(
          unsafeBrandId<ClientId>(
            getIdFromPlatformStatesPK(parsedClient.data.PK)
          ),
          parsedClient.data
        );
        return acc;
      }

      throw genericInternalError(
        `Unknown platform-states type for entry: ${JSON.stringify(e)} `
      );
    },
    {
      purposes: new Map<PurposeId, PlatformStatesPurposeEntry>(),
      agreements: new Map<AgreementId, PlatformStatesAgreementEntry>(),
      eservices: new Map<
        EServiceId,
        Map<DescriptorId, PlatformStatesCatalogEntry>
      >(),
      clients: new Map<ClientId, PlatformStatesClientEntry>(),
    }
  );

  const purposes = await readModelService.getAllReadModelPurposes();
  const purposesById = new Map(
    purposes.map((purpose) => [purpose.id, purpose])
  );

  const agreements = await readModelService.getAllReadModelAgreements();
  const agreementsById = new Map<AgreementId, Agreement>();
  const agreementsByConsumerIdEserviceId = new Map<
    GSIPKConsumerIdEServiceId,
    Agreement[]
  >();

  for (const agreement of agreements) {
    agreementsById.set(agreement.id, agreement);

    const consumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
    });
    const existingAgreements =
      agreementsByConsumerIdEserviceId.get(consumerIdEServiceId);

    agreementsByConsumerIdEserviceId.set(consumerIdEServiceId, [
      ...(existingAgreements || []),
      agreement,
    ]);
  }

  const eservices = await readModelService.getAllReadModelEServices();
  const eservicesById = new Map<EServiceId, EService>();
  for (const eservice of eservices) {
    eservicesById.set(eservice.id, eservice);
  }

  const clients = await readModelService.getAllReadModelClients();
  const clientsById = new Map<ClientId, Client>(
    clients.map((client) => [unsafeBrandId<ClientId>(client.id), client])
  );

  const purposeDifferences = await compareReadModelPurposesWithPlatformStates({
    platformStatesPurposeById: platformStates.purposes,
    purposesById,
    logger,
  });
  const agreementDifferences =
    await compareReadModelAgreementsWithPlatformStates({
      platformStatesAgreementById: platformStates.agreements,
      agreementsById,
      logger,
    });
  const catalogDifferences = await compareReadModelEServicesWithPlatformStates({
    platformStatesEServiceById: platformStates.eservices,
    eservicesById,
    logger,
  });
  const clientAndTokenGenStatesDifferences =
    await compareReadModelClientsAndTokenGenStates({
      platformStatesClientById: platformStates.clients,
      tokenGenStatesByClient,
      clientsById,
      purposesById,
      eservicesById,
      agreementsByConsumerIdEserviceId,
      logger,
    });

  return (
    purposeDifferences.length +
    agreementDifferences.length +
    catalogDifferences.length +
    clientAndTokenGenStatesDifferences.length
  );
}

// purposes
export async function compareReadModelPurposesWithPlatformStates({
  platformStatesPurposeById,
  purposesById,
  logger,
}: {
  platformStatesPurposeById: Map<PurposeId, PlatformStatesPurposeEntry>;
  purposesById: Map<PurposeId, Purpose>;
  logger: Logger;
}): Promise<PurposeDifferencesResult> {
  const allIds = new Set([
    ...platformStatesPurposeById.keys(),
    ...purposesById.keys(),
  ]);

  return Array.from(allIds).reduce<PurposeDifferencesResult>((acc, id) => {
    const platformStatesEntry = platformStatesPurposeById.get(id);
    const purpose = purposesById.get(id);

    if (!platformStatesEntry && !purpose) {
      throw genericInternalError(
        `Purpose and platform-states entry not found for id: ${id}`
      );
    }

    if (!purpose) {
      logger.error(`Read model purpose not found for id: ${id}`);

      return [
        ...acc,
        [
          platformStatesEntry
            ? ComparisonPlatformStatesPurposeEntry.parse(platformStatesEntry)
            : undefined,
          purpose,
        ],
      ];
    }

    const purposeState = getPurposeStateFromPurposeVersions(purpose.versions);
    const lastPurposeVersion = getLastPurposeVersion(purpose.versions);

    const {
      isPlatformStatesPurposeCorrect: isPlatformStatesCorrect,
      data: platformPurposeEntryDiff,
    } = validatePurposePlatformStates({
      platformPurposeEntry: platformStatesEntry,
      purpose,
      purposeState,
      lastPurposeVersion,
      logger,
    });

    if (!isPlatformStatesCorrect) {
      const purposeDifferencesEntry: [
        ComparisonPlatformStatesPurposeEntry | undefined,
        ComparisonPurpose | undefined
      ] = [platformPurposeEntryDiff, ComparisonPurpose.parse(purpose)];
      return [...acc, purposeDifferencesEntry];
    }

    return acc;
  }, []);
}

function validatePurposePlatformStates({
  platformPurposeEntry: platformStatesPurposeEntry,
  purpose,
  purposeState,
  lastPurposeVersion,
  logger,
}: {
  platformPurposeEntry: PlatformStatesPurposeEntry | undefined;
  purpose: Purpose;
  purposeState: ItemState;
  lastPurposeVersion: PurposeVersion;
  logger: Logger;
}): {
  isPlatformStatesPurposeCorrect: boolean;
  data: ComparisonPlatformStatesPurposeEntry | undefined;
} {
  const isArchived = lastPurposeVersion.state === purposeVersionState.archived;
  if (!platformStatesPurposeEntry) {
    if (!isArchived) {
      logger.error(
        `Purpose platform-states entry is missing for purpose with id: ${purpose.id}`
      );
    }

    return {
      isPlatformStatesPurposeCorrect: isArchived,
      data: undefined,
    };
  }

  const isPlatformStatesPurposeCorrect =
    !isArchived &&
    getIdFromPlatformStatesPK<PurposeId>(platformStatesPurposeEntry.PK) ===
      purpose.id &&
    purposeState === platformStatesPurposeEntry.state &&
    platformStatesPurposeEntry.purposeConsumerId === purpose.consumerId &&
    platformStatesPurposeEntry.purposeEserviceId === purpose.eserviceId &&
    platformStatesPurposeEntry.purposeVersionId === lastPurposeVersion.id;

  if (!isPlatformStatesPurposeCorrect) {
    logger.error(
      `Purpose states are not equal:
  platform-states entry: ${JSON.stringify(
    ComparisonPlatformStatesPurposeEntry.parse(platformStatesPurposeEntry)
  )}
  purpose read-model: ${JSON.stringify(ComparisonPurpose.parse(purpose))}`
    );
  }

  return {
    isPlatformStatesPurposeCorrect,
    data: {
      PK: platformStatesPurposeEntry.PK,
      state: platformStatesPurposeEntry.state,
      purposeConsumerId: platformStatesPurposeEntry.purposeConsumerId,
      purposeEserviceId: platformStatesPurposeEntry.purposeEserviceId,
      purposeVersionId: platformStatesPurposeEntry.purposeVersionId,
    },
  };
}

// agreements
export async function compareReadModelAgreementsWithPlatformStates({
  platformStatesAgreementById,
  agreementsById,
  logger,
}: {
  platformStatesAgreementById: Map<AgreementId, PlatformStatesAgreementEntry>;
  agreementsById: Map<AgreementId, Agreement>;
  logger: Logger;
}): Promise<AgreementDifferencesResult> {
  const allIds = new Set([
    ...platformStatesAgreementById.keys(),
    ...agreementsById.keys(),
  ]);

  return Array.from(allIds).reduce<AgreementDifferencesResult>((acc, id) => {
    const platformStatesEntry = platformStatesAgreementById.get(id);
    const agreement = agreementsById.get(id);

    if (!platformStatesEntry && !agreement) {
      throw genericInternalError(
        `Agreement and platform-states entry not found for id: ${id}`
      );
    }

    if (!agreement) {
      logger.error(`Read model agreement not found for id: ${id}`);

      return [
        ...acc,
        [
          platformStatesEntry
            ? ComparisonPlatformStatesAgreementEntry.parse(platformStatesEntry)
            : undefined,
          agreement,
        ],
      ];
    }

    const agreementItemState = agreementStateToItemState(agreement.state);
    const {
      isPlatformStatesAgreementCorrect: isPlatformStatesCorrect,
      data: platformAgreementEntryDiff,
    } = validateAgreementPlatformStates({
      platformAgreementEntry: platformStatesEntry,
      agreement,
      agreementItemState,
      logger,
    });

    if (!isPlatformStatesCorrect) {
      const agreementDifferencesEntry: [
        ComparisonPlatformStatesAgreementEntry | undefined,
        ComparisonAgreement | undefined
      ] = [platformAgreementEntryDiff, ComparisonAgreement.parse(agreement)];
      return [...acc, agreementDifferencesEntry];
    }

    return acc;
  }, []);
}

function validateAgreementPlatformStates({
  platformAgreementEntry,
  agreement,
  agreementItemState,
  logger,
}: {
  platformAgreementEntry: PlatformStatesAgreementEntry | undefined;
  agreement: Agreement;
  agreementItemState: ItemState;
  logger: Logger;
}): {
  isPlatformStatesAgreementCorrect: boolean;
  data: ComparisonPlatformStatesAgreementEntry | undefined;
} {
  const isArchived = agreement.state === agreementState.archived;

  if (!platformAgreementEntry) {
    if (!isArchived) {
      logger.error(
        `Agreement platform-states entry is missing for agreement with id: ${agreement.id}`
      );
    }

    return {
      isPlatformStatesAgreementCorrect: isArchived,
      data: undefined,
    };
  }

  const isPlatformStatesAgreementCorrect =
    !isArchived &&
    agreementItemState === platformAgreementEntry.state &&
    platformAgreementEntry.GSIPK_consumerId_eserviceId ===
      makeGSIPKConsumerIdEServiceId({
        consumerId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
      }) &&
    platformAgreementEntry.agreementDescriptorId === agreement.descriptorId;

  if (!isPlatformStatesAgreementCorrect) {
    logger.error(
      `Agreement states are not equal:
  platform-states entry: ${JSON.stringify(
    ComparisonPlatformStatesAgreementEntry.parse(platformAgreementEntry)
  )}
  agreement: ${JSON.stringify(ComparisonAgreement.parse(agreement))}`
    );
  }

  return {
    isPlatformStatesAgreementCorrect,
    data: {
      PK: platformAgreementEntry.PK,
      state: platformAgreementEntry.state,
      GSIPK_consumerId_eserviceId:
        platformAgreementEntry.GSIPK_consumerId_eserviceId,
      agreementDescriptorId: platformAgreementEntry.agreementDescriptorId,
    },
  };
}

// eservices
export async function compareReadModelEServicesWithPlatformStates({
  platformStatesEServiceById,
  eservicesById,
  logger,
}: {
  platformStatesEServiceById: Map<
    EServiceId,
    Map<DescriptorId, PlatformStatesCatalogEntry>
  >;
  eservicesById: Map<EServiceId, EService>;
  logger: Logger;
}): Promise<CatalogDifferencesResult> {
  const allIds = new Set([
    ...platformStatesEServiceById.keys(),
    ...eservicesById.keys(),
  ]);

  return Array.from(allIds).reduce<CatalogDifferencesResult>((acc, id) => {
    const platformStatesEntries = platformStatesEServiceById.get(id);
    const eservice = eservicesById.get(id);

    if (!platformStatesEntries && !eservice) {
      throw genericInternalError(
        `E-Service and platform-states entries not found for id: ${id}`
      );
    } else if (platformStatesEntries && !eservice) {
      logger.error(`Read model e-service not found for id: ${id}`);

      const parsedEntries = Array.from(platformStatesEntries.values()).map(
        (entry) => ComparisonPlatformStatesCatalogEntry.parse(entry)
      );
      const wrongPlatformStatesCatalogEntries: Array<
        [ComparisonPlatformStatesCatalogEntry, undefined]
      > = parsedEntries.map((entry) => [entry, eservice]);

      return [...acc, ...wrongPlatformStatesCatalogEntries];
    } else if (eservice) {
      const {
        isPlatformStatesCatalogCorrect: isPlatformStatesCorrect,
        data: platformCatalogEntriesDiff,
      } = validateCatalogPlatformStates({
        platformCatalogEntries: platformStatesEntries,
        eservice,
        logger,
      });

      if (!isPlatformStatesCorrect) {
        const catalogDifferences: CatalogDifferencesResult =
          platformCatalogEntriesDiff
            ? platformCatalogEntriesDiff.reduce<CatalogDifferencesResult>(
                (accDiff, platformCatalogEntryDiff) => {
                  const catalogDifferencesEntry: [
                    ComparisonPlatformStatesCatalogEntry | undefined,
                    ComparisonEService | undefined
                  ] = [
                    platformCatalogEntryDiff,
                    ComparisonEService.parse(eservice),
                  ];

                  return [...accDiff, catalogDifferencesEntry];
                },
                []
              )
            : [[undefined, ComparisonEService.parse(eservice)]];

        return [...acc, ...catalogDifferences];
      }
    }

    return acc;
  }, []);
}

function validateCatalogPlatformStates({
  platformCatalogEntries,
  eservice,
  logger,
}: {
  platformCatalogEntries:
    | Map<DescriptorId, PlatformStatesCatalogEntry>
    | undefined;
  eservice: EService;
  logger: Logger;
}): {
  isPlatformStatesCatalogCorrect: boolean;
  data: ComparisonPlatformStatesCatalogEntry[] | undefined;
} {
  const areLengthsEqual =
    getValidDescriptors(eservice.descriptors).length ===
    (platformCatalogEntries ? platformCatalogEntries.size : 0);

  if (!platformCatalogEntries) {
    if (!areLengthsEqual) {
      logger.error(
        `platform-states catalog entries length is incorrect for e-service with id ${eservice.id}`
      );
    }
    return {
      isPlatformStatesCatalogCorrect: areLengthsEqual,
      data: undefined,
    };
  }

  const wrongPlatformStatesCatalogEntries = Array.from(
    platformCatalogEntries.entries()
  ).reduce<ComparisonPlatformStatesCatalogEntry[]>(
    (acc, [descriptorId, platformStatesEntry]) => {
      const descriptor = eservice.descriptors.find(
        (d) => d.id === descriptorId
      );
      if (!descriptor || descriptor.id !== descriptorId) {
        throw genericInternalError(
          `Catalog platform-states entry with descriptor id ${descriptorId} is missing from e-service with id ${eservice.id}`
        );
      }

      const catalogState = descriptorStateToItemState(descriptor.state);
      const isPlatformStatesCatalogCorrect =
        areLengthsEqual &&
        platformStatesEntry.state === catalogState &&
        platformStatesEntry.descriptorVoucherLifespan ===
          descriptor.voucherLifespan &&
        descriptor.audience.every((aud) =>
          platformStatesEntry.descriptorAudience.includes(aud)
        );

      if (!isPlatformStatesCatalogCorrect) {
        const wrongPlatformStatesCatalogEntry = {
          PK: platformStatesEntry.PK,
          state: platformStatesEntry.state,
          descriptorVoucherLifespan:
            platformStatesEntry.descriptorVoucherLifespan,
          descriptorAudience: platformStatesEntry.descriptorAudience,
        };

        logger.error(`Catalog states are not equal:
          platform-states entry: ${JSON.stringify(
            ComparisonPlatformStatesCatalogEntry.parse(platformStatesEntry)
          )}
          eservice read-model: ${JSON.stringify(
            ComparisonEService.parse(eservice)
          )}`);

        return [...acc, wrongPlatformStatesCatalogEntry];
      }

      return acc;
    },
    []
  );

  return {
    isPlatformStatesCatalogCorrect:
      wrongPlatformStatesCatalogEntries.length === 0 && areLengthsEqual,
    data:
      wrongPlatformStatesCatalogEntries.length > 0
        ? wrongPlatformStatesCatalogEntries
        : undefined,
  };
}

// clients
export async function compareReadModelClientsAndTokenGenStates({
  platformStatesClientById,
  tokenGenStatesByClient,
  clientsById,
  purposesById,
  eservicesById,
  agreementsByConsumerIdEserviceId,
  logger,
}: {
  platformStatesClientById: Map<ClientId, PlatformStatesClientEntry>;
  tokenGenStatesByClient: Map<ClientId, TokenGenerationStatesGenericClient[]>;
  clientsById: Map<ClientId, Client>;
  purposesById: Map<PurposeId, Purpose>;
  eservicesById: Map<EServiceId, EService>;
  agreementsByConsumerIdEserviceId: Map<GSIPKConsumerIdEServiceId, Agreement[]>;
  logger: Logger;
}): Promise<ClientDifferencesResult> {
  const allIds = new Set([
    ...platformStatesClientById.keys(),
    ...tokenGenStatesByClient.keys(),
    ...clientsById.keys(),
  ]);

  return Array.from(allIds).reduce<ClientDifferencesResult>((acc, id) => {
    const platformStatesEntry = platformStatesClientById.get(id);
    const tokenGenStatesEntries = tokenGenStatesByClient.get(id);
    const client = clientsById.get(id);

    if (!platformStatesEntry && !tokenGenStatesEntries?.length && !client) {
      throw genericInternalError(
        `Client, platform-states entry and token-generation states entries not found for id: ${id}`
      );
    }

    if (!client) {
      logger.error(`Read model client not found for id: ${id}`);

      return [
        ...acc,
        [
          platformStatesEntry
            ? ComparisonPlatformStatesClientEntry.parse(platformStatesEntry)
            : undefined,
          tokenGenStatesEntries && tokenGenStatesEntries.length > 0
            ? ComparisonTokenGenStatesGenericClient.array().parse(
                tokenGenStatesEntries
              )
            : undefined,
          client,
        ],
      ];
    }

    const {
      isPlatformStatesClientCorrect: isPlatformStatesCorrect,
      data: platformClientEntryDiff,
    } = validateClientPlatformStates({
      platformClientEntry: platformStatesEntry,
      client,
      logger,
    });

    const {
      isTokenGenerationStatesClientCorrect: isTokenGenerationStatesCorrect,
      data: tokenGenStatesDiff,
    } = validateTokenGenerationStates({
      tokenGenStatesEntries,
      client,
      purposesById,
      eservicesById,
      agreementsByConsumerIdEserviceId,
      logger,
    });

    if (!isPlatformStatesCorrect || !isTokenGenerationStatesCorrect) {
      const clientDifferencesEntry: [
        ComparisonPlatformStatesClientEntry | undefined,
        ComparisonTokenGenStatesGenericClient[] | undefined,
        ComparisonClient | undefined
      ] = [
        platformClientEntryDiff,
        tokenGenStatesDiff,
        ComparisonClient.parse(client),
      ];
      return [...acc, clientDifferencesEntry];
    }

    return acc;
  }, []);
}

function validateClientPlatformStates({
  platformClientEntry: platformStatesClientEntry,
  client,
  logger,
}: {
  platformClientEntry: PlatformStatesClientEntry | undefined;
  client: Client;
  logger: Logger;
}): {
  isPlatformStatesClientCorrect: boolean;
  data: ComparisonPlatformStatesClientEntry | undefined;
} {
  if (!platformStatesClientEntry) {
    logger.error(
      `Client platform-states entry is missing for client with id: ${client.id}`
    );
    return { isPlatformStatesClientCorrect: false, data: undefined };
  }

  const isPlatformStatesClientCorrect =
    platformStatesClientEntry.state === itemState.active &&
    getIdFromPlatformStatesPK<ClientId>(platformStatesClientEntry.PK) ===
      client.id &&
    platformStatesClientEntry.clientKind ===
      clientKindToTokenGenerationStatesClientKind(client.kind) &&
    platformStatesClientEntry.clientConsumerId === client.consumerId &&
    platformStatesClientEntry.clientPurposesIds.every((p) =>
      client.purposes.includes(p)
    );

  if (!isPlatformStatesClientCorrect) {
    logger.error(
      `Client states are not equal:
  platform-states entry: ${JSON.stringify(
    ComparisonPlatformStatesClientEntry.parse(platformStatesClientEntry)
  )}
  client read-model: ${JSON.stringify(ComparisonClient.parse(client))}`
    );

    return {
      isPlatformStatesClientCorrect,
      data: {
        PK: platformStatesClientEntry.PK,
        clientKind: platformStatesClientEntry.clientKind,
        clientConsumerId: platformStatesClientEntry.clientConsumerId,
        clientPurposesIds: platformStatesClientEntry.clientPurposesIds,
      },
    };
  }

  return {
    isPlatformStatesClientCorrect,
    data: undefined,
  };
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function validateTokenGenerationStates({
  tokenGenStatesEntries,
  client,
  purposesById,
  eservicesById,
  agreementsByConsumerIdEserviceId,
  logger,
}: {
  tokenGenStatesEntries: TokenGenerationStatesGenericClient[] | undefined;
  client: Client;
  purposesById: Map<PurposeId, Purpose>;
  eservicesById: Map<EServiceId, EService>;
  agreementsByConsumerIdEserviceId: Map<GSIPKConsumerIdEServiceId, Agreement[]>;
  logger: Logger;
}): {
  isTokenGenerationStatesClientCorrect: boolean;
  data: ComparisonTokenGenStatesGenericClient[] | undefined;
} {
  if (!tokenGenStatesEntries || tokenGenStatesEntries.length === 0) {
    if (client.keys.length === 0) {
      return {
        isTokenGenerationStatesClientCorrect: true,
        data: undefined,
      };
    }

    logger.error(
      `Client ${client.id} has ${client.keys.length} ${
        client.keys.length > 1 ? "keys" : "key"
      } but zero token-generation-states entries`
    );
    return {
      isTokenGenerationStatesClientCorrect: false,
      data: undefined,
    };
  }

  const tokenGenStatesEntriesCount =
    client.purposes.length > 0
      ? client.keys.length * client.purposes.length
      : client.keys.length;
  const wrongTokenGenStatesEntries = tokenGenStatesEntries.reduce<
    ComparisonTokenGenStatesGenericClient[]
  >(
    (acc, e) =>
      match(e)
        // eslint-disable-next-line complexity
        .with({ clientKind: clientKindTokenGenStates.consumer }, (e) => {
          if (client.purposes.length !== 0) {
            // TokenGenerationStatesConsumerClient with CLIENTKIDPURPOSE PK
            const purposeId = getPurposeIdFromTokenGenStatesPK(e.PK);
            const purpose = purposeId ? purposesById.get(purposeId) : undefined;

            if (!purpose) {
              if (
                TokenGenerationStatesClientKidPurposePK.safeParse(e.PK).success
              ) {
                logger.error(
                  `no purpose found in read model for token-generation-states entry with PK ${e.PK}`
                );
              }

              logger.error(
                `token-generation-states entry has PK ${e.PK}, but should have a CLIENTKIDPURPOSE PK`
              );
              return [
                ...acc,
                {
                  PK: e.PK,
                  consumerId: e.consumerId,
                  clientKind: e.clientKind,
                  publicKey: e.publicKey,
                  GSIPK_clientId: e.GSIPK_clientId,
                  GSIPK_kid: e.GSIPK_kid,
                  GSIPK_clientId_purposeId: e.GSIPK_clientId_purposeId,
                },
              ];
            }

            const purposeState = getPurposeStateFromPurposeVersions(
              purpose.versions
            );
            const lastPurposeVersion = getLastPurposeVersion(purpose.versions);
            const agreements = agreementsByConsumerIdEserviceId.get(
              makeGSIPKConsumerIdEServiceId({
                consumerId: client.consumerId,
                eserviceId: purpose.eserviceId,
              })
            );

            if (!agreements) {
              logger.error(
                `no agreements found in read model for token-generation-states entry with PK ${e.PK}`
              );

              return [
                ...acc,
                {
                  PK: e.PK,
                  consumerId: e.consumerId,
                  clientKind: e.clientKind,
                  publicKey: e.publicKey,
                  GSIPK_clientId: e.GSIPK_clientId,
                  GSIPK_kid: e.GSIPK_kid,
                  GSIPK_clientId_purposeId: e.GSIPK_clientId_purposeId,
                  GSIPK_purposeId: e.GSIPK_purposeId,
                  purposeState: e.purposeState,
                  purposeVersionId: e.purposeVersionId,
                  GSIPK_eserviceId_descriptorId:
                    e.GSIPK_eserviceId_descriptorId,
                },
              ];
            }

            const agreement = getLastAgreement(agreements);
            const agreementItemState = agreementStateToItemState(
              agreement.state
            );

            const eservice = eservicesById.get(agreement.eserviceId);

            const descriptor = eservice?.descriptors.find(
              (d) => d.id === agreement.descriptorId
            );

            if (!eservice || !descriptor) {
              const missingEServiceDescriptor = [
                !eservice ? "e-service" : null,
                !descriptor ? "descriptor" : null,
              ]
                .filter(Boolean)
                .join(" and ");

              logger.error(
                `no ${missingEServiceDescriptor} in read model for token-generation-states entry with PK ${e.PK}`
              );

              return [
                ...acc,
                {
                  PK: e.PK,
                  consumerId: e.consumerId,
                  clientKind: e.clientKind,
                  publicKey: e.publicKey,
                  GSIPK_clientId: e.GSIPK_clientId,
                  GSIPK_kid: e.GSIPK_kid,
                  GSIPK_clientId_purposeId: e.GSIPK_clientId_purposeId,
                  GSIPK_purposeId: e.GSIPK_purposeId,
                  purposeState: e.purposeState,
                  purposeVersionId: e.purposeVersionId,
                  GSIPK_eserviceId_descriptorId:
                    e.GSIPK_eserviceId_descriptorId,
                  agreementId: e.agreementId,
                  agreementState: e.agreementState,
                },
              ];
            }

            if (
              getClientIdFromTokenGenStatesPK(e.PK) !== client.id ||
              e.consumerId !== client.consumerId ||
              e.GSIPK_clientId !== client.id ||
              client.keys.every(
                (k) => !(k.kid === e.GSIPK_kid && k.encodedPem === e.publicKey)
              ) ||
              e.GSIPK_kid !== getKidFromTokenGenStatesPK(e.PK) ||
              e.GSIPK_clientId_purposeId !==
                makeGSIPKClientIdPurposeId({
                  clientId: client.id,
                  purposeId: purpose.id,
                }) ||
              e.GSIPK_purposeId !== purpose.id ||
              e.purposeState !== purposeState ||
              e.purposeVersionId !== lastPurposeVersion.id ||
              e.GSIPK_consumerId_eserviceId !==
                makeGSIPKConsumerIdEServiceId({
                  consumerId: client.consumerId,
                  eserviceId: purpose.eserviceId,
                }) ||
              e.agreementId !== agreement.id ||
              e.agreementState !== agreementItemState ||
              e.GSIPK_eserviceId_descriptorId !==
                makeGSIPKEServiceIdDescriptorId({
                  eserviceId: agreement.eserviceId,
                  descriptorId: agreement.descriptorId,
                }) ||
              e.descriptorState !==
                descriptorStateToItemState(descriptor.state) ||
              e.descriptorAudience !== descriptor.audience ||
              e.descriptorVoucherLifespan !== descriptor.voucherLifespan
            ) {
              const wrongTokenGenStatesEntry: ComparisonTokenGenStatesGenericClient =
                {
                  PK: e.PK,
                  consumerId: e.consumerId,
                  clientKind: e.clientKind,
                  publicKey: e.publicKey,
                  GSIPK_clientId: e.GSIPK_clientId,
                  GSIPK_kid: e.GSIPK_kid,
                  GSIPK_clientId_purposeId: e.GSIPK_clientId_purposeId,
                  GSIPK_purposeId: e.GSIPK_purposeId,
                  purposeState: e.purposeState,
                  purposeVersionId: e.purposeVersionId,
                  GSIPK_consumerId_eserviceId: e.GSIPK_consumerId_eserviceId,
                  agreementId: e.agreementId,
                  agreementState: e.agreementState,
                  GSIPK_eserviceId_descriptorId:
                    e.GSIPK_eserviceId_descriptorId,
                  descriptorState: e.descriptorState,
                  descriptorAudience: e.descriptorAudience,
                  descriptorVoucherLifespan: e.descriptorVoucherLifespan,
                };

              logger.error(`token-generation-states entry with PK ${
                e.PK
              } is incorrect:
  ${JSON.stringify(wrongTokenGenStatesEntry)}`);
              return [...acc, wrongTokenGenStatesEntry];
            }
          } else {
            // TokenGenerationStatesConsumerClient with CLIENTKID PK
            if (TokenGenerationStatesClientKidPK.safeParse(e.PK).success) {
              if (
                getClientIdFromTokenGenStatesPK(e.PK) !== client.id ||
                e.consumerId !== client.consumerId ||
                e.GSIPK_clientId !== client.id ||
                client.keys.every(
                  (k) =>
                    !(k.kid === e.GSIPK_kid && k.encodedPem === e.publicKey)
                ) ||
                e.GSIPK_kid !== getKidFromTokenGenStatesPK(e.PK)
              ) {
                return [
                  ...acc,
                  {
                    PK: e.PK,
                    consumerId: e.consumerId,
                    clientKind: e.clientKind,
                    publicKey: e.publicKey,
                    GSIPK_clientId: e.GSIPK_clientId,
                    GSIPK_kid: e.GSIPK_kid,
                  },
                ];
              }
            } else {
              logger.error(
                `token-generation-states entry has PK ${e.PK}, but should have a CLIENTKID PK`
              );

              return [
                ...acc,
                {
                  PK: e.PK,
                  consumerId: e.consumerId,
                  clientKind: e.clientKind,
                  publicKey: e.publicKey,
                  GSIPK_clientId: e.GSIPK_clientId,
                  GSIPK_kid: e.GSIPK_kid,
                  GSIPK_clientId_purposeId: e.GSIPK_clientId_purposeId,
                  GSIPK_purposeId: e.GSIPK_purposeId,
                  purposeState: e.purposeState,
                  purposeVersionId: e.purposeVersionId,
                  GSIPK_consumerId_eserviceId: e.GSIPK_consumerId_eserviceId,
                  agreementId: e.agreementId,
                  agreementState: e.agreementState,
                  GSIPK_eserviceId_descriptorId:
                    e.GSIPK_eserviceId_descriptorId,
                  descriptorState: e.descriptorState,
                  descriptorAudience: e.descriptorAudience,
                  descriptorVoucherLifespan: e.descriptorVoucherLifespan,
                },
              ];
            }
          }
          return acc;
        })
        .with({ clientKind: clientKindTokenGenStates.api }, (e) => {
          if (
            getClientIdFromTokenGenStatesPK(e.PK) !== client.id ||
            e.consumerId !== client.consumerId ||
            e.GSIPK_clientId !== client.id ||
            client.keys.every(
              (k) => !(k.kid === e.GSIPK_kid && k.encodedPem === e.publicKey)
            ) ||
            e.GSIPK_kid !== getKidFromTokenGenStatesPK(e.PK)
          ) {
            return [
              ...acc,
              {
                PK: e.PK,
                consumerId: e.consumerId,
                clientKind: e.clientKind,
                publicKey: e.publicKey,
                GSIPK_clientId: e.GSIPK_clientId,
                GSIPK_kid: e.GSIPK_kid,
              },
            ];
          }
          return acc;
        })
        .exhaustive(),
    []
  );
  return {
    isTokenGenerationStatesClientCorrect:
      wrongTokenGenStatesEntries.length === 0 &&
      tokenGenStatesEntries.length === tokenGenStatesEntriesCount,
    data:
      wrongTokenGenStatesEntries.length > 0
        ? wrongTokenGenStatesEntries
        : undefined,
  };
}

export const agreementStateToItemState = (state: AgreementState): ItemState =>
  state === agreementState.active ? itemState.active : itemState.inactive;

export const getPurposeStateFromPurposeVersions = (
  purposeVersions: PurposeVersion[]
): ItemState => {
  if (purposeVersions.find((v) => v.state === purposeVersionState.active)) {
    return itemState.active;
  } else {
    return itemState.inactive;
  }
};

export const clientKindToTokenGenerationStatesClientKind = (
  kind: ClientKind
): ClientKindTokenGenStates =>
  match<ClientKind, ClientKindTokenGenStates>(kind)
    .with(clientKind.consumer, () => clientKindTokenGenStates.consumer)
    .with(clientKind.api, () => clientKindTokenGenStates.api)
    .exhaustive();

export const descriptorStateToItemState = (state: DescriptorState): ItemState =>
  state === descriptorState.published || state === descriptorState.deprecated
    ? itemState.active
    : itemState.inactive;
