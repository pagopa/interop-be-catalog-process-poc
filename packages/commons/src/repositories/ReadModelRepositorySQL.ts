import { genericInternalError } from "pagopa-interop-models";
import pgPromise from "pg-promise";
import { DB } from "./db.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const readmodelRepositorySQL = (db: DB) => ({
  async writeItem(
    preparedStatement: pgPromise.PreparedStatement
  ): Promise<void> {
    try {
      await db.tx(async (t) => {
        await t.none(preparedStatement);
      });
    } catch (error) {
      throw genericInternalError(`Error writing stuff: ${error}`);
    }
  },
  async writeItems(
    preparedStatements: pgPromise.PreparedStatement[]
  ): Promise<void> {
    try {
      await db.tx(async (t) => {
        for (const ps of preparedStatements) {
          await t.none(ps);
        }
      });
    } catch (error) {
      throw genericInternalError(`Error writing stuff: ${error}`);
    }
  },
  // eslint-disable-next-line sonarjs/no-identical-functions
  async deleteItem(
    preparedStatement: pgPromise.PreparedStatement
  ): Promise<void> {
    try {
      await db.tx(async (t) => {
        await t.none(preparedStatement);
      });
    } catch (error) {
      throw genericInternalError(`Error writing stuff: ${error}`);
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async readItem(preparedStatement: pgPromise.PreparedStatement): Promise<any> {
    try {
      return await db.one(preparedStatement);
    } catch (error) {
      throw genericInternalError(`Error reading stuff: ${error}`);
    }
  },
  async readItems(
    preparedStatement: pgPromise.PreparedStatement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any[]> {
    try {
      return await db.manyOrNone(preparedStatement);
    } catch (error) {
      throw genericInternalError(`Error reading stuff: ${error}`);
    }
  },
});

export type ReadModelRepositorySQL = ReturnType<typeof readmodelRepositorySQL>;
