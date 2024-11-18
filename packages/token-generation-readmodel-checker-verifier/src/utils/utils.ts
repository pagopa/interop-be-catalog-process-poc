import { ReadModelRepository, Logger } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementId,
  agreementState,
  AgreementState,
  Client,
  ClientId,
  clientKind,
  ClientKind,
  ClientKindTokenStates,
  clientKindTokenStates,
  Descriptor,
  DescriptorId,
  DescriptorState,
  descriptorState,
  EService,
  EServiceId,
  genericInternalError,
  GSIPKClientIdPurposeId,
  GSIPKConsumerIdEServiceId,
  GSIPKEServiceIdDescriptorId,
  itemState,
  ItemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  PlatformStatesAgreementEntry,
  PlatformStatesAgreementPK,
  PlatformStatesCatalogEntry,
  PlatformStatesClientEntry,
  PlatformStatesClientPK,
  PlatformStatesEServiceDescriptorPK,
  PlatformStatesGenericEntry,
  PlatformStatesPurposeEntry,
  PlatformStatesPurposePK,
  Purpose,
  PurposeId,
  PurposeVersion,
  purposeVersionState,
  TenantId,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesClientKidPurposePK,
  TokenGenerationStatesClientPurposeEntry,
  TokenGenerationStatesGenericEntry,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { tokenGenerationReadModelServiceBuilder } from "../services/tokenGenerationReadModelService.js";
import { config } from "../configs/config.js";
import {
  AgreementDifferencesResult,
  ComparisonPlatformStatesAgreementEntry,
  ComparisonPlatformStatesPurposeEntry,
  PurposeDifferencesResult,
  ComparisonAgreement,
  ComparisonPurpose,
  ComparisonTokenStatesAgreementEntry,
  ComparisonTokenStatesPurposeEntry,
  ComparisonPlatformStatesCatalogEntry,
  ComparisonTokenStatesCatalogEntry,
  CatalogDifferencesResult,
  ComparisonEService,
  ComparisonPlatformStatesClientEntry,
  ComparisonTokenStatesClientEntry,
  ClientDifferencesResult,
  ComparisonClient,
} from "../models/types.js";

type Accumulator = {
  platformPurposeEntries: PlatformStatesPurposeEntry[];
  platformAgreementEntries: PlatformStatesAgreementEntry[];
  platformCatalogEntries: PlatformStatesCatalogEntry[];
  platformClientEntries: PlatformStatesClientEntry[];
};

export function getLastPurposeVersion(
  purposeVersions: PurposeVersion[]
): PurposeVersion {
  return purposeVersions.toSorted(
    (purposeVersion1, purposeVersion2) =>
      purposeVersion2.createdAt.getTime() - purposeVersion1.createdAt.getTime()
  )[0];
}

export function getLastEServiceDescriptor(
  descriptors: Descriptor[]
): Descriptor | undefined {
  return descriptors.toSorted(
    (descriptor1, descriptor2) =>
      descriptor2.createdAt.getTime() - descriptor1.createdAt.getTime()
  )[0];
}

function getIdFromPlatformStatesPK<
  T extends PurposeId | AgreementId | ClientId | EServiceId
>(
  pk:
    | PlatformStatesPurposePK
    | PlatformStatesAgreementPK
    | PlatformStatesClientPK
    | PlatformStatesEServiceDescriptorPK
): {
  id: T;
  descriptorId?: DescriptorId;
} {
  const splitPK = pk.split("#");
  if (PlatformStatesEServiceDescriptorPK.safeParse(pk).success) {
    return {
      id: unsafeBrandId<T>(splitPK[1]),
      descriptorId: unsafeBrandId<DescriptorId>(splitPK[2]),
    };
  }
  return { id: unsafeBrandId<T>(splitPK[1]) };
}

function getClientIdFromTokenStatesPK(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): ClientId {
  const splitPK = pk.split("#");
  return unsafeBrandId<ClientId>(splitPK[1]);
}

function getPurposeIdFromTokenStatesPK(
  pk: TokenGenerationStatesClientKidPurposePK | TokenGenerationStatesClientKidPK
): PurposeId | undefined {
  const splitPK = pk.split("#");
  return unsafeBrandId<PurposeId>(splitPK[3]);
}

function getIdsFromGSIPKClientIdPurposeId(gsiPK?: GSIPKClientIdPurposeId):
  | {
      clientId: ClientId;
      purposeId: PurposeId;
    }
  | undefined {
  if (!gsiPK) {
    return undefined;
  }

  const splitPK = gsiPK.split("#");
  return {
    clientId: unsafeBrandId<ClientId>(splitPK[0]),
    purposeId: unsafeBrandId<PurposeId>(splitPK[1]),
  };
}

function getIdsFromGSIPKEServiceIdDescriptorId(
  gsiPK?: GSIPKEServiceIdDescriptorId
):
  | {
      eserviceId: EServiceId;
      descriptorId: DescriptorId;
    }
  | undefined {
  if (!gsiPK) {
    return undefined;
  }

  const splitPK = gsiPK.split("#");
  return {
    eserviceId: unsafeBrandId<EServiceId>(splitPK[0]),
    descriptorId: unsafeBrandId<DescriptorId>(splitPK[1]),
  };
}

function getIdsFromGSIPKConsumerIdEServiceId(
  gsiPK?: GSIPKConsumerIdEServiceId
):
  | {
      consumerId: TenantId;
      eserviceId: EServiceId;
    }
  | undefined {
  if (!gsiPK) {
    return undefined;
  }

  const splitPK = gsiPK.split("#");
  return {
    consumerId: unsafeBrandId<TenantId>(splitPK[0]),
    eserviceId: unsafeBrandId<EServiceId>(splitPK[1]),
  };
}

export async function compareTokenGenerationReadModel(
  dynamoDBClient: DynamoDBClient,
  loggerInstance: Logger
): Promise<number> {
  loggerInstance.info(
    "Token generation read model and read model comparison started.\n"
  );
  loggerInstance.info("> Connecting to database...");
  const readModel = ReadModelRepository.init(config);
  const readModelService = readModelServiceBuilder(readModel);
  loggerInstance.info("> Connected to database!\n");

  const tokenGenerationService =
    tokenGenerationReadModelServiceBuilder(dynamoDBClient);
  const platformStatesEntries =
    await tokenGenerationService.readAllPlatformStatesItems();
  const tokenGenerationStatesEntries =
    await tokenGenerationService.readAllTokenGenerationStatesItems();
  const tokenGenerationStatesClientPurposeEntries: TokenGenerationStatesClientPurposeEntry[] =
    tokenGenerationStatesEntries
      .map((e) => TokenGenerationStatesClientPurposeEntry.safeParse(e))
      .filter(
        (
          res
        ): res is {
          success: true;
          data: TokenGenerationStatesClientPurposeEntry;
        } => res.success
      )
      .map((res) => res.data);

  const {
    platformPurposeEntries,
    platformAgreementEntries,
    platformCatalogEntries,
    platformClientEntries,
  } = platformStatesEntries.reduce<Accumulator>(
    (acc: Accumulator, e: PlatformStatesGenericEntry) => {
      const parsedPurpose = PlatformStatesPurposeEntry.safeParse(e);
      if (parsedPurpose.success) {
        return {
          ...acc,
          platformPurposeEntries: [
            ...acc.platformPurposeEntries,
            parsedPurpose.data,
          ],
        };
      }

      const parsedAgreement = PlatformStatesAgreementEntry.safeParse(e);
      if (parsedAgreement.success) {
        return {
          ...acc,
          platformAgreementEntries: [
            ...acc.platformAgreementEntries,
            parsedAgreement.data,
          ],
        };
      }

      const parsedCatalog = PlatformStatesCatalogEntry.safeParse(e);
      if (parsedCatalog.success) {
        return {
          ...acc,
          platformCatalogEntries: [
            ...acc.platformCatalogEntries,
            parsedCatalog.data,
          ],
        };
      }

      const parsedClient = PlatformStatesClientEntry.safeParse(e);
      if (parsedClient.success) {
        return {
          ...acc,
          platformClientEntries: [
            ...acc.platformClientEntries,
            parsedClient.data,
          ],
        };
      }

      throw genericInternalError(
        `Unknown platform-states type for entry: ${JSON.stringify(e)} `
      );
    },
    {
      platformPurposeEntries: [],
      platformAgreementEntries: [],
      platformCatalogEntries: [],
      platformClientEntries: [],
    }
  );
  const purposeDifferences =
    await compareReadModelPurposesWithTokenGenReadModel({
      platformStatesEntries: platformPurposeEntries,
      tokenGenerationStatesEntries: tokenGenerationStatesClientPurposeEntries,
      readModelService,
    });
  const agreementDifferences =
    await compareReadModelAgreementsWithTokenGenReadModel({
      platformStatesEntries: platformAgreementEntries,
      tokenGenerationStatesEntries: tokenGenerationStatesClientPurposeEntries,
      readModelService,
    });
  const catalogDifferences =
    await compareReadModelEServicesWithTokenGenReadModel({
      platformStatesEntries: platformCatalogEntries,
      tokenGenerationStatesEntries: tokenGenerationStatesClientPurposeEntries,
      readModelService,
    });
  const clientDifferences = await compareReadModelClientsWithTokenGenReadModel({
    platformStatesEntries: platformClientEntries,
    tokenGenerationStatesEntries,
    readModelService,
  });

  return (
    countPurposeDifferences(purposeDifferences, loggerInstance) +
    countAgreementDifferences(agreementDifferences, loggerInstance) +
    countCatalogDifferences(catalogDifferences, loggerInstance) +
    countClientDifferences(clientDifferences, loggerInstance)
  );
}

// purposes
export async function compareReadModelPurposesWithTokenGenReadModel({
  platformStatesEntries,
  tokenGenerationStatesEntries,
  readModelService,
}: {
  platformStatesEntries: PlatformStatesPurposeEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  readModelService: ReturnType<typeof readModelServiceBuilder>;
}): Promise<PurposeDifferencesResult> {
  return zipPurposeDataById(
    platformStatesEntries,
    tokenGenerationStatesEntries,
    await readModelService.getAllReadModelPurposes()
  ).reduce<PurposeDifferencesResult>(
    (acc, [platformStatesEntry, tokenStatesEntry, purpose]) => {
      if (!purpose) {
        // eslint-disable-next-line functional/immutable-data
        acc.push([
          platformStatesEntry
            ? ComparisonPlatformStatesPurposeEntry.parse(platformStatesEntry)
            : undefined,
          tokenStatesEntry && tokenStatesEntry.length > 0
            ? ComparisonTokenStatesPurposeEntry.array().parse(tokenStatesEntry)
            : undefined,
          undefined,
        ]);
        return acc;
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
      });

      const {
        isTokenGenerationStatesPurposeCorrect: isTokenGenerationStatesCorrect,
        data: tokenPurposeEntryDiff,
      } = validatePurposeTokenGenerationStates({
        tokenEntries: tokenStatesEntry,
        purpose,
        purposeState,
        lastPurposeVersion,
      });

      if (!isPlatformStatesCorrect || !isTokenGenerationStatesCorrect) {
        // eslint-disable-next-line functional/immutable-data
        acc.push([
          platformPurposeEntryDiff,
          tokenPurposeEntryDiff,
          ComparisonPurpose.parse(purpose),
        ]);
      }

      return acc;
    },
    []
  );
}

function validatePurposePlatformStates({
  platformPurposeEntry,
  purpose,
  purposeState,
  lastPurposeVersion,
}: {
  platformPurposeEntry: PlatformStatesPurposeEntry | undefined;
  purpose: Purpose;
  purposeState: ItemState;
  lastPurposeVersion: PurposeVersion;
}): {
  isPlatformStatesPurposeCorrect: boolean;
  data: ComparisonPlatformStatesPurposeEntry | undefined;
} {
  const isArchived = lastPurposeVersion.state === purposeVersionState.archived;
  const isPlatformStatesPurposeCorrect = !platformPurposeEntry
    ? isArchived
    : !isArchived &&
      getIdFromPlatformStatesPK<PurposeId>(platformPurposeEntry.PK).id ===
        purpose.id &&
      purposeState === platformPurposeEntry.state &&
      platformPurposeEntry.purposeConsumerId === purpose.consumerId &&
      platformPurposeEntry.purposeEserviceId === purpose.eserviceId &&
      platformPurposeEntry.purposeVersionId === lastPurposeVersion.id;

  return {
    isPlatformStatesPurposeCorrect,
    data:
      !isPlatformStatesPurposeCorrect && platformPurposeEntry
        ? {
            PK: platformPurposeEntry.PK,
            state: platformPurposeEntry.state,
            purposeConsumerId: platformPurposeEntry.purposeConsumerId,
            purposeEserviceId: platformPurposeEntry.purposeEserviceId,
            purposeVersionId: platformPurposeEntry.purposeVersionId,
          }
        : undefined,
  };
}

function validatePurposeTokenGenerationStates({
  tokenEntries,
  purpose,
  purposeState,
  lastPurposeVersion,
}: {
  tokenEntries: TokenGenerationStatesClientPurposeEntry[] | undefined;
  purpose: Purpose;
  purposeState: ItemState;
  lastPurposeVersion: PurposeVersion;
}): {
  isTokenGenerationStatesPurposeCorrect: boolean;
  data: ComparisonTokenStatesPurposeEntry[] | undefined;
} {
  if (!tokenEntries || tokenEntries.length === 0) {
    return {
      isTokenGenerationStatesPurposeCorrect: false,
      data: undefined,
    };
  }

  const foundEntries = tokenEntries.filter(
    (e) =>
      getPurposeIdFromTokenStatesPK(e.PK) !== purpose.id ||
      e.consumerId !== purpose.consumerId ||
      e.GSIPK_purposeId !== purpose.id ||
      e.purposeState !== purposeState ||
      e.purposeVersionId !== lastPurposeVersion.id ||
      getIdsFromGSIPKClientIdPurposeId(e.GSIPK_clientId_purposeId)
        ?.purposeId !== purpose.id
  );

  return {
    isTokenGenerationStatesPurposeCorrect: foundEntries.length === 0,
    data:
      foundEntries.length > 0
        ? foundEntries.map((entry) => ({
            PK: entry.PK,
            consumerId: entry.consumerId,
            GSIPK_purposeId: entry.GSIPK_purposeId,
            purposeState: entry.purposeState,
            purposeVersionId: entry.purposeVersionId,
            GSIPK_clientId_purposeId: entry.GSIPK_clientId_purposeId,
          }))
        : undefined,
  };
}

export function zipPurposeDataById(
  platformStates: PlatformStatesPurposeEntry[],
  tokenStates: TokenGenerationStatesClientPurposeEntry[],
  purposes: Purpose[]
): Array<
  [
    PlatformStatesPurposeEntry | undefined,
    TokenGenerationStatesClientPurposeEntry[],
    Purpose | undefined
  ]
> {
  const allIds = new Set([
    ...platformStates.map(
      (platformEntry) => getIdFromPlatformStatesPK(platformEntry.PK).id
    ),
    ...tokenStates.map((tokenEntry) =>
      getPurposeIdFromTokenStatesPK(tokenEntry.PK)
    ),
    ...purposes.map((purpose) => purpose.id),
  ]);
  return Array.from(allIds).map((id) => [
    platformStates.find(
      (platformEntry: PlatformStatesPurposeEntry) =>
        getIdFromPlatformStatesPK(platformEntry.PK).id === id
    ),
    tokenStates.filter(
      (tokenEntry: TokenGenerationStatesClientPurposeEntry) =>
        getPurposeIdFromTokenStatesPK(tokenEntry.PK) === id
    ),
    purposes.find((purpose: Purpose) => purpose.id === id),
  ]);
}

export function countPurposeDifferences(
  differences: PurposeDifferencesResult,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformPurpose, tokenPurpose, readModelPurpose]) => {
    if (!readModelPurpose) {
      if (platformPurpose) {
        logger.error(
          `Read model purpose not found for id: ${
            getIdFromPlatformStatesPK(platformPurpose.PK).id
          }`
        );
      } else if (tokenPurpose?.[0].GSIPK_purposeId) {
        logger.error(
          `Read model purpose not found for id: ${getPurposeIdFromTokenStatesPK(
            tokenPurpose[0].PK
          )}`
        );
      } else {
        throw genericInternalError(
          "Unexpected error while counting purpose differences"
        );
      }
      differencesCount++;
    } else if (readModelPurpose) {
      logger.error(
        `Purpose states are not equal:
  platform-states entry: ${JSON.stringify(platformPurpose)}
  token-generation-states entries: ${JSON.stringify(tokenPurpose)}
  purpose read-model: ${JSON.stringify(readModelPurpose)}`
      );
      differencesCount++;
    }
  });

  return differencesCount;
}

// agreements
export async function compareReadModelAgreementsWithTokenGenReadModel({
  platformStatesEntries,
  tokenGenerationStatesEntries,
  readModelService,
}: {
  platformStatesEntries: PlatformStatesAgreementEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  readModelService: ReturnType<typeof readModelServiceBuilder>;
}): Promise<AgreementDifferencesResult> {
  return zipAgreementDataById(
    platformStatesEntries,
    tokenGenerationStatesEntries,
    await readModelService.getAllReadModelAgreements()
  ).reduce<AgreementDifferencesResult>(
    (acc, [platformStatesEntry, tokenStatesEntry, agreement]) => {
      if (!agreement) {
        // eslint-disable-next-line functional/immutable-data
        acc.push([
          platformStatesEntry
            ? ComparisonPlatformStatesAgreementEntry.parse(platformStatesEntry)
            : undefined,
          tokenStatesEntry && tokenStatesEntry.length > 0
            ? ComparisonTokenStatesAgreementEntry.array().parse(
                tokenStatesEntry
              )
            : undefined,
          undefined,
        ]);
        return acc;
      }

      const agreementItemState = agreementStateToItemState(agreement.state);
      const {
        isPlatformStatesAgreementCorrect: isPlatformStatesAgreementCorrect,
        data: platformAgreementEntryDiff,
      } = validateAgreementPlatformStates({
        platformAgreementEntry: platformStatesEntry,
        agreement,
        agreementItemState,
      });

      const {
        isTokenGenerationStatesAgreementCorrect: isTokenGenerationStatesCorrect,
        data: tokenAgreementEntryDiff,
      } = validateAgreementTokenGenerationStates({
        tokenEntries: tokenStatesEntry,
        agreementState: agreementItemState,
        agreement,
      });

      if (
        !isPlatformStatesAgreementCorrect ||
        !isTokenGenerationStatesCorrect
      ) {
        // eslint-disable-next-line functional/immutable-data
        acc.push([
          platformAgreementEntryDiff,
          tokenAgreementEntryDiff,
          ComparisonAgreement.parse(agreement),
        ]);
      }

      return acc;
    },
    []
  );
}

function validateAgreementPlatformStates({
  platformAgreementEntry,
  agreement,
  agreementItemState,
}: {
  platformAgreementEntry: PlatformStatesAgreementEntry | undefined;
  agreement: Agreement;
  agreementItemState: ItemState;
}): {
  isPlatformStatesAgreementCorrect: boolean;
  data: ComparisonPlatformStatesAgreementEntry | undefined;
} {
  const isArchived = agreement.state === agreementState.archived;
  const isPlatformStatesAgreementCorrect = !platformAgreementEntry
    ? isArchived
    : !isArchived &&
      agreementItemState === platformAgreementEntry.state &&
      platformAgreementEntry.GSIPK_consumerId_eserviceId ===
        makeGSIPKConsumerIdEServiceId({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        }) &&
      platformAgreementEntry.agreementDescriptorId === agreement.descriptorId;

  return {
    isPlatformStatesAgreementCorrect,
    data:
      !isPlatformStatesAgreementCorrect && platformAgreementEntry
        ? {
            PK: platformAgreementEntry.PK,
            state: platformAgreementEntry.state,
            GSIPK_consumerId_eserviceId:
              platformAgreementEntry.GSIPK_consumerId_eserviceId,
            agreementDescriptorId: platformAgreementEntry.agreementDescriptorId,
          }
        : undefined,
  };
}

function validateAgreementTokenGenerationStates({
  tokenEntries,
  agreementState,
  agreement,
}: {
  tokenEntries: TokenGenerationStatesClientPurposeEntry[];
  agreementState: ItemState;
  agreement: Agreement;
}): {
  isTokenGenerationStatesAgreementCorrect: boolean;
  data: ComparisonTokenStatesAgreementEntry[] | undefined;
} {
  if (!tokenEntries || tokenEntries.length === 0) {
    return {
      isTokenGenerationStatesAgreementCorrect: true,
      data: undefined,
    };
  }

  const foundEntries = tokenEntries.filter(
    (e) =>
      e.consumerId !== agreement.consumerId ||
      e.agreementId !== agreement.id ||
      e.agreementState !== agreementState ||
      e.GSIPK_consumerId_eserviceId !==
        makeGSIPKConsumerIdEServiceId({
          consumerId: agreement.consumerId,
          eserviceId: agreement.eserviceId,
        }) ||
      getIdsFromGSIPKEServiceIdDescriptorId(e.GSIPK_eserviceId_descriptorId)
        ?.descriptorId !== agreement.descriptorId
  );

  return {
    isTokenGenerationStatesAgreementCorrect: foundEntries.length === 0,
    data:
      foundEntries.length > 0
        ? foundEntries.map((entry) => ({
            PK: entry.PK,
            consumerId: entry.consumerId,
            agreementId: entry.agreementId,
            agreementState: entry.agreementState,
            GSIPK_consumerId_eserviceId: entry.GSIPK_consumerId_eserviceId,
            GSIPK_eserviceId_descriptorId: entry.GSIPK_eserviceId_descriptorId,
          }))
        : undefined,
  };
}

export function zipAgreementDataById(
  platformStates: PlatformStatesAgreementEntry[],
  tokenStates: TokenGenerationStatesClientPurposeEntry[],
  agreements: Agreement[]
): Array<
  [
    PlatformStatesAgreementEntry | undefined,
    TokenGenerationStatesClientPurposeEntry[],
    Agreement | undefined
  ]
> {
  const allIds = new Set([
    ...platformStates.map(
      (platformEntry) => getIdFromPlatformStatesPK(platformEntry.PK).id
    ),
    ...tokenStates.map((tokenEntry) => tokenEntry.agreementId),
    ...agreements.map((agreement) => agreement.id),
  ]);
  return Array.from(allIds).map((id) => [
    platformStates.find(
      (platformEntry: PlatformStatesAgreementEntry) =>
        getIdFromPlatformStatesPK(platformEntry.PK).id === id
    ),
    tokenStates.filter(
      (tokenEntry: TokenGenerationStatesClientPurposeEntry) =>
        tokenEntry.agreementId === id
    ),
    agreements.find((agreement: Agreement) => agreement.id === id),
  ]);
}

export function countAgreementDifferences(
  differences: AgreementDifferencesResult,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(
    ([platformAgreement, tokenAgreement, readModelAgreement]) => {
      if (!readModelAgreement) {
        if (platformAgreement) {
          logger.error(
            `Read model agreement not found for id: ${
              getIdFromPlatformStatesPK(platformAgreement.PK).id
            }`
          );
        } else if (tokenAgreement?.[0].agreementId) {
          logger.error(
            `Read model agreement not found for id: ${tokenAgreement[0].agreementId}`
          );
        } else {
          throw genericInternalError(
            "Unexpected error while counting agreement differences"
          );
        }
        differencesCount++;
      } else if (readModelAgreement) {
        logger.error(
          `Agreement states are not equal:
    platform-states entry: ${JSON.stringify(platformAgreement)}
    token-generation-states entries: ${JSON.stringify(tokenAgreement)}
    agreement read-model: ${JSON.stringify(readModelAgreement)}`
        );
        differencesCount++;
      }
    }
  );

  return differencesCount;
}

// eservices
export async function compareReadModelEServicesWithTokenGenReadModel({
  platformStatesEntries,
  tokenGenerationStatesEntries,
  readModelService,
}: {
  platformStatesEntries: PlatformStatesCatalogEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesClientPurposeEntry[];
  readModelService: ReturnType<typeof readModelServiceBuilder>;
}): Promise<CatalogDifferencesResult> {
  return zipEServiceDataById(
    platformStatesEntries,
    tokenGenerationStatesEntries,
    await readModelService.getAllReadModelEServices()
  ).reduce<CatalogDifferencesResult>(
    (acc, [platformStatesEntry, tokenStatesEntry, eservice]) => {
      const lastEServiceDescriptor = eservice
        ? getLastEServiceDescriptor(eservice.descriptors)
        : undefined;
      if (!eservice || !lastEServiceDescriptor) {
        // eslint-disable-next-line functional/immutable-data
        acc.push([
          platformStatesEntry
            ? ComparisonPlatformStatesCatalogEntry.parse(platformStatesEntry)
            : undefined,
          tokenStatesEntry && tokenStatesEntry.length > 0
            ? ComparisonTokenStatesCatalogEntry.array().parse(tokenStatesEntry)
            : undefined,
          eservice ? ComparisonEService.parse(eservice) : undefined,
        ]);
        return acc;
      }

      const {
        isPlatformStatesCatalogCorrect: isPlatformStatesCorrect,
        data: platformCatalogEntryDiff,
      } = validateCatalogPlatformStates({
        platformCatalogEntry: platformStatesEntry,
        descriptor: lastEServiceDescriptor,
      });

      const {
        isTokenGenerationStatesCatalogCorrect: isTokenGenerationStatesCorrect,
        data: tokenCatalogEntryDiff,
      } = validateCatalogTokenGenerationStates({
        tokenEntries: tokenStatesEntry,
        eservice,
        descriptor: lastEServiceDescriptor,
      });

      if (!isPlatformStatesCorrect || !isTokenGenerationStatesCorrect) {
        // eslint-disable-next-line functional/immutable-data
        acc.push([
          platformCatalogEntryDiff,
          tokenCatalogEntryDiff,
          ComparisonEService.parse(eservice),
        ]);
      }

      return acc;
    },
    []
  );
}

function validateCatalogPlatformStates({
  platformCatalogEntry,
  descriptor,
}: {
  platformCatalogEntry: PlatformStatesCatalogEntry | undefined;
  descriptor: Descriptor;
}): {
  isPlatformStatesCatalogCorrect: boolean;
  data: ComparisonPlatformStatesCatalogEntry | undefined;
} {
  if (!platformCatalogEntry) {
    return {
      isPlatformStatesCatalogCorrect:
        descriptor.state === descriptorState.archived,
      data: undefined,
    };
  }

  const extractedDescriptorId = getIdFromPlatformStatesPK<ClientId>(
    platformCatalogEntry.PK
  ).descriptorId;
  if (descriptor.id !== extractedDescriptorId) {
    return {
      isPlatformStatesCatalogCorrect: false,
      data: ComparisonPlatformStatesCatalogEntry.parse(platformCatalogEntry),
    };
  }

  const isArchived = descriptor.state === descriptorState.archived;
  const catalogState = descriptorStateToItemState(descriptor.state);

  const isPlatformStatesCatalogCorrect =
    !isArchived &&
    platformCatalogEntry.state === catalogState &&
    platformCatalogEntry.descriptorVoucherLifespan ===
      descriptor.voucherLifespan &&
    descriptor.audience.every((aud) =>
      platformCatalogEntry.descriptorAudience.includes(aud)
    );

  return {
    isPlatformStatesCatalogCorrect,
    data: !isPlatformStatesCatalogCorrect
      ? {
          PK: platformCatalogEntry.PK,
          state: platformCatalogEntry.state,
          descriptorVoucherLifespan:
            platformCatalogEntry.descriptorVoucherLifespan,
          descriptorAudience: platformCatalogEntry.descriptorAudience,
        }
      : undefined,
  };
}

function validateCatalogTokenGenerationStates({
  tokenEntries,
  eservice,
  descriptor,
}: {
  tokenEntries: TokenGenerationStatesClientPurposeEntry[];
  eservice: EService;
  descriptor: Descriptor;
}): {
  isTokenGenerationStatesCatalogCorrect: boolean;
  data: ComparisonTokenStatesCatalogEntry[] | undefined;
} {
  if (!tokenEntries || tokenEntries.length === 0) {
    return {
      isTokenGenerationStatesCatalogCorrect: true,
      data: undefined,
    };
  }

  const foundEntries = tokenEntries.filter((e) => {
    const entryDescriptor = eservice.descriptors.find(
      (d) =>
        d.id ===
        getIdsFromGSIPKEServiceIdDescriptorId(e.GSIPK_eserviceId_descriptorId)
          ?.descriptorId
    );
    if (!entryDescriptor || entryDescriptor !== descriptor) {
      return true;
    }

    const catalogState = descriptorStateToItemState(entryDescriptor.state);
    return (
      e.descriptorState !== catalogState ||
      !entryDescriptor.audience.every((aud) =>
        e.descriptorAudience?.includes(aud)
      ) ||
      e.descriptorVoucherLifespan !== entryDescriptor.voucherLifespan ||
      e.GSIPK_eserviceId_descriptorId !==
        makeGSIPKEServiceIdDescriptorId({
          eserviceId: eservice.id,
          descriptorId: entryDescriptor.id,
        }) ||
      getIdsFromGSIPKConsumerIdEServiceId(e.GSIPK_consumerId_eserviceId)
        ?.eserviceId !== eservice.id
    );
  });
  return {
    isTokenGenerationStatesCatalogCorrect: foundEntries.length === 0,
    data:
      foundEntries.length > 0
        ? foundEntries.map(
            (entry): ComparisonTokenStatesCatalogEntry => ({
              PK: entry.PK,
              GSIPK_consumerId_eserviceId: entry.GSIPK_consumerId_eserviceId,
              GSIPK_eserviceId_descriptorId:
                entry.GSIPK_eserviceId_descriptorId,
              descriptorState: entry.descriptorState,
              descriptorAudience: entry.descriptorAudience,
              descriptorVoucherLifespan: entry.descriptorVoucherLifespan,
            })
          )
        : undefined,
  };
}

export function zipEServiceDataById(
  platformStates: PlatformStatesCatalogEntry[],
  tokenStates: TokenGenerationStatesClientPurposeEntry[],
  eservices: EService[]
): Array<
  [
    PlatformStatesCatalogEntry | undefined,
    TokenGenerationStatesClientPurposeEntry[],
    EService | undefined
  ]
> {
  const allIds = new Set([
    ...platformStates.map(
      (platformEntry) => getIdFromPlatformStatesPK(platformEntry.PK).id
    ),
    ...tokenStates.flatMap((tokenEntry) =>
      tokenEntry.GSIPK_eserviceId_descriptorId
        ? [
            getIdsFromGSIPKEServiceIdDescriptorId(
              tokenEntry.GSIPK_eserviceId_descriptorId
            )?.eserviceId,
          ]
        : tokenEntry.GSIPK_consumerId_eserviceId
        ? [
            getIdsFromGSIPKConsumerIdEServiceId(
              tokenEntry.GSIPK_consumerId_eserviceId
            )?.eserviceId,
          ]
        : []
    ),
    ...eservices.map((eservice) => eservice.id),
  ]);
  return Array.from(allIds).map((id) => [
    platformStates.find(
      (platformEntry: PlatformStatesCatalogEntry) =>
        getIdFromPlatformStatesPK(platformEntry.PK).id === id
    ),
    tokenStates.filter(
      (tokenEntry: TokenGenerationStatesClientPurposeEntry) =>
        getIdsFromGSIPKEServiceIdDescriptorId(
          tokenEntry.GSIPK_eserviceId_descriptorId
        )?.eserviceId === id ||
        getIdsFromGSIPKConsumerIdEServiceId(
          tokenEntry.GSIPK_consumerId_eserviceId
        )?.eserviceId === id
    ),
    eservices.find((eservice: EService) => eservice.id === id),
  ]);
}

export function countCatalogDifferences(
  differences: CatalogDifferencesResult,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformCatalog, tokenCatalog, readModelEService]) => {
    if (!readModelEService) {
      if (platformCatalog) {
        logger.error(
          `Read model eservice not found for ${
            getIdFromPlatformStatesPK(platformCatalog.PK).id
          }`
        );
      } else if (tokenCatalog?.[0].GSIPK_eserviceId_descriptorId) {
        logger.error(
          `Read model eservice not found for ${
            getIdsFromGSIPKEServiceIdDescriptorId(
              tokenCatalog[0].GSIPK_eserviceId_descriptorId
            )?.eserviceId
          }`
        );
      } else {
        throw genericInternalError(
          "Unexpected error while counting catalog differences"
        );
      }
      differencesCount++;
    } else if (readModelEService) {
      logger.error(
        `Catalog states are not equal:
  platform-states entry: ${JSON.stringify(platformCatalog)}
  token-generation-states entries: ${JSON.stringify(tokenCatalog)}
  purpose read-model: ${JSON.stringify(readModelEService)}`
      );
      differencesCount++;
    }
  });

  return differencesCount;
}

// clients
export async function compareReadModelClientsWithTokenGenReadModel({
  platformStatesEntries,
  tokenGenerationStatesEntries,
  readModelService,
}: {
  platformStatesEntries: PlatformStatesClientEntry[];
  tokenGenerationStatesEntries: TokenGenerationStatesGenericEntry[];
  readModelService: ReturnType<typeof readModelServiceBuilder>;
}): Promise<ClientDifferencesResult> {
  return zipClientDataById(
    platformStatesEntries,
    tokenGenerationStatesEntries,
    await readModelService.getAllReadModelClients()
  ).reduce<ClientDifferencesResult>(
    (acc, [platformStatesEntry, tokenStatesEntry, client]) => {
      // TODO: are missing token entries considered errors or not?
      if (
        !client ||
        (client && (!platformStatesEntry || tokenStatesEntry?.length === 0))
      ) {
        // eslint-disable-next-line functional/immutable-data
        acc.push([
          platformStatesEntry
            ? ComparisonPlatformStatesClientEntry.parse(platformStatesEntry)
            : undefined,
          tokenStatesEntry && tokenStatesEntry.length > 0
            ? ComparisonTokenStatesClientEntry.array().parse(tokenStatesEntry)
            : undefined,
          client ? ComparisonClient.parse(client) : undefined,
        ]);
        return acc;
      }

      const {
        isPlatformStatesClientCorrect: isPlatformStatesCorrect,
        data: platformClientEntryDiff,
      } = validateClientPlatformStates({
        platformClientEntry: platformStatesEntry,
        client,
      });

      const {
        isTokenGenerationStatesClientCorrect: isTokenGenerationStatesCorrect,
        data: tokenClientEntryDiff,
      } = validateClientTokenGenerationStates({
        tokenEntries: tokenStatesEntry,
        client,
      });
      if (!isPlatformStatesCorrect || !isTokenGenerationStatesCorrect) {
        // eslint-disable-next-line functional/immutable-data
        acc.push([
          platformClientEntryDiff,
          tokenClientEntryDiff,
          ComparisonClient.parse(client),
        ]);
      }

      return acc;
    },
    []
  );
}

function validateClientPlatformStates({
  platformClientEntry,
  client,
}: {
  platformClientEntry: PlatformStatesClientEntry | undefined;
  client: Client;
}): {
  isPlatformStatesClientCorrect: boolean;
  data: ComparisonPlatformStatesClientEntry | undefined;
} {
  const isPlatformStatesClientCorrect = !platformClientEntry
    ? true
    : getIdFromPlatformStatesPK<ClientId>(platformClientEntry.PK).id ===
        client.id &&
      platformClientEntry.clientKind ===
        clientKindToTokenGenerationStatesClientKind(client.kind) &&
      platformClientEntry.clientConsumerId === client.consumerId &&
      platformClientEntry.clientPurposesIds.every((p) =>
        client.purposes.includes(p)
      );

  return {
    isPlatformStatesClientCorrect,
    data:
      !isPlatformStatesClientCorrect && platformClientEntry
        ? {
            PK: platformClientEntry.PK,
            clientKind: platformClientEntry.clientKind,
            clientConsumerId: platformClientEntry.clientConsumerId,
            clientPurposesIds: platformClientEntry.clientPurposesIds,
          }
        : undefined,
  };
}

function validateClientTokenGenerationStates({
  tokenEntries,
  client,
}: {
  tokenEntries: TokenGenerationStatesGenericEntry[] | undefined;
  client: Client;
}): {
  isTokenGenerationStatesClientCorrect: boolean;
  data: ComparisonTokenStatesClientEntry[] | undefined;
} {
  // TODO: is this correct?
  if (!tokenEntries || tokenEntries.length === 0) {
    return {
      isTokenGenerationStatesClientCorrect: true,
      data: undefined,
    };
  }

  const parsedTokenClientPurposeEntry =
    TokenGenerationStatesClientPurposeEntry.safeParse(tokenEntries[0]);
  const foundEntries = tokenEntries.filter(
    (e) =>
      getClientIdFromTokenStatesPK(e.PK) !== client.id ||
      e.consumerId !== client.consumerId ||
      e.clientKind !==
        clientKindToTokenGenerationStatesClientKind(client.kind) ||
      e.GSIPK_clientId !== client.id ||
      client.keys.some(
        (k) => k.kid !== e.GSIPK_kid || k.encodedPem !== e.publicKey
      ) ||
      (parsedTokenClientPurposeEntry.success
        ? getIdsFromGSIPKClientIdPurposeId(
            parsedTokenClientPurposeEntry.data.GSIPK_clientId_purposeId
          )?.clientId !== client.id
        : true)
  );

  return {
    isTokenGenerationStatesClientCorrect: foundEntries.length === 0,
    data:
      foundEntries.length > 0
        ? foundEntries.map((entry) => ({
            PK: entry.PK,
            consumerId: entry.consumerId,
            clientKind: entry.clientKind,
            GSIPK_clientId: entry.GSIPK_clientId,
            GSIPK_clientId_purposeId:
              parsedTokenClientPurposeEntry.data?.GSIPK_clientId_purposeId,
          }))
        : undefined,
  };
}

export function zipClientDataById(
  platformStates: PlatformStatesClientEntry[],
  tokenStates: TokenGenerationStatesGenericEntry[],
  clients: Client[]
): Array<
  [
    PlatformStatesClientEntry | undefined,
    TokenGenerationStatesGenericEntry[] | undefined,
    Client | undefined
  ]
> {
  const allIds = new Set([
    ...platformStates.map(
      (platformEntry) => getIdFromPlatformStatesPK(platformEntry.PK).id
    ),
    ...tokenStates.map((tokenEntry) =>
      getClientIdFromTokenStatesPK(tokenEntry.PK)
    ),
    ...clients.map((client) => client.id),
  ]);
  return Array.from(allIds).map((id) => [
    platformStates.find(
      (platformEntry: PlatformStatesClientEntry) =>
        getIdFromPlatformStatesPK(platformEntry.PK).id === id
    ),
    tokenStates.filter(
      (tokenEntry: TokenGenerationStatesGenericEntry) =>
        getClientIdFromTokenStatesPK(tokenEntry.PK) === id
    ),
    clients.find((client: Client) => client.id === id),
  ]);
}

export function countClientDifferences(
  differences: ClientDifferencesResult,
  logger: Logger
): number {
  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  differences.forEach(([platformClient, tokenClient, readModelClient]) => {
    if (!readModelClient) {
      if (platformClient) {
        logger.error(
          `Read model client not found for ${
            getIdFromPlatformStatesPK(platformClient.PK).id
          }`
        );
      } else if (tokenClient && tokenClient.length > 0) {
        logger.error(
          `Read model client not found for ${getClientIdFromTokenStatesPK(
            tokenClient[0].PK
          )}`
        );
      } else {
        throw genericInternalError(
          "Unexpected error while counting client differences"
        );
      }
      differencesCount++;
    } else if (readModelClient) {
      logger.error(
        `Client states are not equal.
        platform-states entry: ${JSON.stringify(platformClient)}
        token-generation-states entries: ${JSON.stringify(tokenClient)}
        purpose read-model: ${JSON.stringify(readModelClient)}`
      );
      differencesCount++;
    }
  });

  return differencesCount;
}

// TODO: copied
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
): ClientKindTokenStates =>
  match<ClientKind, ClientKindTokenStates>(kind)
    .with(clientKind.consumer, () => clientKindTokenStates.consumer)
    .with(clientKind.api, () => clientKindTokenStates.api)
    .exhaustive();

export const descriptorStateToItemState = (state: DescriptorState): ItemState =>
  state === descriptorState.published || state === descriptorState.deprecated
    ? itemState.active
    : itemState.inactive;
