import {
  EService,
  ErrorTypes,
  PersistentAgreement,
  Tenant,
} from "pagopa-interop-models";
import { Collection, Db, MongoClient } from "mongodb";
import { z } from "zod";
import { ReadModelDbConfig, logger } from "../index.js";

export type EServiceCollection = Collection<{
  data: EService | undefined;
  metadata: { version: number };
}>;

export type AgreementCollection = Collection<{
  data: PersistentAgreement;
  metadata: { version: number };
}>;

export type TenantCollection = Collection<{
  data: Tenant;
  metadata: { version: number };
}>;

export type Collections =
  | EServiceCollection
  | AgreementCollection
  | TenantCollection;

export class ReadModelRepository {
  private static instance: ReadModelRepository;

  public eservices: EServiceCollection;

  public agreements: AgreementCollection;

  public tenants: TenantCollection;

  private client: MongoClient;
  private db: Db;

  private constructor({
    readModelDbHost: host,
    readModelDbPort: port,
    readModelDbUsername: username,
    readModelDbPassword: password,
    readModelDbName: database,
  }: ReadModelDbConfig) {
    const mongoDBConnectionURI = `mongodb://${username}:${password}@${host}:${port}`;
    this.client = new MongoClient(mongoDBConnectionURI, {
      retryWrites: false,
    });
    this.db = this.client.db(database);
    this.eservices = this.db.collection("eservices", { ignoreUndefined: true });
    this.agreements = this.db.collection("agreements", {
      ignoreUndefined: true,
    });
    this.tenants = this.db.collection("tenants", { ignoreUndefined: true });
  }

  public static init(config: ReadModelDbConfig): ReadModelRepository {
    if (!ReadModelRepository.instance) {
      // eslint-disable-next-line functional/immutable-data
      ReadModelRepository.instance = new ReadModelRepository(config);
    }

    return ReadModelRepository.instance;
  }

  public static async getTotalCount(
    collection: Collections,
    aggregation: object[]
  ): Promise<number> {
    const query = collection.aggregate([...aggregation, { $count: "count" }]);

    const data = await query.toArray();
    const result = z.array(z.object({ count: z.number() })).safeParse(data);

    if (result.success) {
      return result.data.length > 0 ? result.data[0].count : 0;
    }

    logger.error(
      `Unable to get total count from aggregation pipeline: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw ErrorTypes.GenericError;
  }
}
