/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */

/*
const Config = z
  .object({
    READMODEL_SQL_DB_USERNAME: z.string(),
    READMODEL_SQL_DB_PASSWORD: z.string(),
    READMODEL_SQL_DB_HOST: z.string(),
    READMODEL_SQL_DB_PORT: z.coerce.number(),
    READMODEL_SQL_DB_NAME: z.string(),
    READMODEL_SQL_DB_SCHEMA: z.string(),
    READMODEL_SQL_DB_USE_SSL: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    readmodelSQLDbUsername: c.READMODEL_SQL_DB_USERNAME,
    readmodelSQLDbPassword: encodeURIComponent(c.READMODEL_SQL_DB_PASSWORD),
    readmodelSQLDbHost: c.READMODEL_SQL_DB_HOST,
    readmodelSQLDbPort: c.READMODEL_SQL_DB_PORT,
    readmodelSQLDbName: c.READMODEL_SQL_DB_NAME,
    readmodelSQLDbSchema: c.READMODEL_SQL_DB_SCHEMA,
    readmodelSQLDbUseSSL: c.READMODEL_SQL_DB_USE_SSL,
  }));
export type Config = z.infer<typeof Config>;

export const config: Config = Config.parse(process.env);

export type DB = IDatabase<unknown>;

export function initDB({
  username,
  password,
  host,
  port,
  database,
  schema,
  useSSL,
}: {
  username: string;
  password: string;
  host: string;
  port: number;
  database: string;
  schema: string;
  useSSL: boolean;
}): DB {
  const pgp = pgPromise({
    schema,
  });

  const conData = new ConnectionString(
    `postgresql://${username}:${password}@${host}:${port}/${database}`
  );

  const dbConfig: IConnectionParameters<IClient> = {
    database: conData.path !== undefined ? conData.path[0] : "",
    host: conData.hostname,
    password: conData.password,
    port: conData.port,
    user: conData.user,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  };

  return pgp(dbConfig);
}
*/

console.log("Initializing connection to database");
// const connection = initDB({
//   username: config.readmodelSQLDbUsername,
//   password: config.readmodelSQLDbPassword,
//   host: config.readmodelSQLDbHost,
//   port: config.readmodelSQLDbPort,
//   database: config.readmodelSQLDbName,
//   schema: config.readmodelSQLDbSchema,
//   useSSL: config.readmodelSQLDbUseSSL,
// });

// const readModelRepositorySQL = readmodelRepositorySQL(connection);

/*

EService -> splitEserviceIntoObjectsSQL -> statements -> write

SQL row -> read -> parseEserviceSQL -> aggregator -> Eservice

*/

// const aggregateEserviceFromObjectsSQL = ({
//   eserviceSQL,
//   descriptorsSQL,
//   documentsSQL,
// }) => {};

// const start = new Date().getMilliseconds();
/*
await readModelRepositorySQL.writeItem(
  prepareInsertEservice(getMockEServiceSQL())
);

await readModelRepositorySQL.writeItem(
  prepareInsertDescriptor(getMockDescriptorSQL())
);

await readModelRepositorySQL.writeItem(
  prepareInsertDescriptorDocument(getMockDescriptorDocumentSQL())
);

await readModelRepositorySQL.writeItem(
  prepareInsertDescriptorAttribute(getMockDescriptorAttributeSQL())
);

*/

// const descriptorAttributes: EserviceAttributes = {
//   certified: [[{ id: generateId(), explicitAttributeVerification: true }]],
//   verified: [
//     [{ id: generateId(), explicitAttributeVerification: true }],
//     [
//       { id: generateId(), explicitAttributeVerification: true },
//       { id: generateId(), explicitAttributeVerification: true },
//     ],
//   ],
//   declared: [],
// };
// const document1 = getMockDocument();
// const document2 = getMockDocument();
// const interface1 = getMockDocument();
// const interface2 = getMockDocument();
// const descriptor1: Descriptor = {
//   ...getMockDescriptor(),
//   description: "123",
//   interface: interface1,
//   attributes: descriptorAttributes,
//   docs: [document1],
// };
// const descriptor2: Descriptor = {
//   ...getMockDescriptor(),
//   description: "321",
//   state: descriptorState.published,
//   interface: interface2,
//   docs: [document2],
// };

// const fullEservice: EService = {
//   ...getMockEService(),
//   descriptors: [descriptor1, descriptor2],
// };

// const itemsSQL = splitEserviceIntoObjectsSQL(fullEservice);

// const setupStatements = (payload: {
//   eserviceSQL: EServiceSQL;
//   descriptorsSQL: DescriptorSQL[];
//   attributesSQL: DescriptorAttributeSQL[];
//   documentsSQL: DocumentSQL[];
// }): pgPromise.PreparedStatement[] => {
//   console.log(payload);
//   return [
//     prepareInsertEservice(payload.eserviceSQL),
//     ...payload.descriptorsSQL.map(prepareInsertDescriptor),
//     ...payload.documentsSQL.map(prepareInsertDescriptorDocument),
//     ...payload.attributesSQL.map(prepareInsertDescriptorAttribute),
//   ];
// };
/*
const preparedStatemets = setupStatements(itemsSQL);
await readModelRepositorySQL.writeItems(preparedStatemets);

const readEserviceStatement = prepareReadEservice(fullEservice.id);

const rawEserviceResult = await readModelRepositorySQL.readItem(
  readEserviceStatement
);
const parsedEserviceSQL = parseEserviceSQL(rawEserviceResult);
// console.log("parsed: ", parsedEserviceSQL);

const readDescriptorsStatement = prepareReadDescriptorsByEserviceId(
  fullEservice.id
);
const rawDescriptorResults = await readModelRepositorySQL.readItems(
  readDescriptorsStatement
);
const parsedDescriptorsSQL = rawDescriptorResults.map(parseDescriptorSQL);
// console.log(parsedDescriptorsSQL);

const testDescriptorSQL = parsedDescriptorsSQL.filter(
  (d) => d !== undefined
)[0];
const test = testDescriptorSQL
  ? descriptorSQLtoDescriptor(testDescriptorSQL, [], [])
  : 1;
// console.log(test);
// console.log(new Date().getMilliseconds() - start);
*/

export * from "./catalog/utilsV2.js";
