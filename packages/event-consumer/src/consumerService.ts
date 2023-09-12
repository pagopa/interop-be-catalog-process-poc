import { match } from "ts-pattern";
import { Collection, MongoClient } from "mongodb";
import { logger } from "pagopa-interop-commons";
import { EService } from "pagopa-interop-models";
import { EventEnvelope } from "./model/models.js";
import { config } from "./utilities/config.js";
import {
  fromDescriptorV1,
  fromDocumentV1,
  fromEServiceV1,
} from "./model/converter.js";

const {
  readModelDbUsername: username,
  readModelDbPassword: password,
  readModelDbHost: host,
  readModelDbPort: port,
  readModelDbName: database,
} = config;

const mongoDBConectionURI = `mongodb://${username}:${password}@${host}:${port}`;
const client = new MongoClient(mongoDBConectionURI);

const db = client.db(database);
const eservices: Collection<{
  data: EService | undefined;
  metadata: { version: number };
}> = db.collection("eservices", { ignoreUndefined: true });

export async function handleMessage(message: EventEnvelope): Promise<void> {
  logger.info(message);
  await match(message)
    .with({ type: "EServiceAdded" }, async (msg) => {
      await eservices.insertOne({
        data: msg.data.eService ? fromEServiceV1(msg.data.eService) : undefined,
        metadata: {
          version: msg.version,
        },
      });
    })
    .with(
      { type: "ClonedEServiceAdded" },
      async (msg) =>
        await eservices.insertOne({
          data: msg.data.eService
            ? fromEServiceV1(msg.data.eService)
            : undefined,
          metadata: { version: msg.version },
        })
    )
    .with(
      { type: "EServiceUpdated" },
      async (msg) =>
        await eservices.updateOne(
          { "data.id": msg.stream_id },
          {
            $set: {
              data: msg.data.eService
                ? fromEServiceV1(msg.data.eService)
                : undefined,
              metadata: {
                version: msg.version,
              },
            },
          }
        )
    )
    .with(
      { type: "EServiceWithDescriptorsDeleted" },
      async (msg) =>
        await eservices.updateOne(
          { "data.id": msg.stream_id },
          {
            $pull: {
              "data.descriptors": {
                id: msg.data.descriptorId,
              },
            },
            $set: {
              "metadata.version": msg.version,
            },
          }
        )
    )
    .with({ type: "EServiceDocumentUpdated" }, async (msg) => {
      await eservices.updateOne(
        { "data.id": msg.stream_id },
        {
          $set: {
            "metadata.version": msg.version,
            "data.descriptors.$[descriptor].docs.$[doc]": msg.data
              .updatedDocument
              ? fromDocumentV1(msg.data.updatedDocument)
              : undefined,
          },
        },
        {
          arrayFilters: [
            {
              "descriptor.id": msg.data.descriptorId,
              "doc.id": msg.data.documentId,
            },
          ],
          ignoreUndefined: true,
        }
      );
      await eservices.updateOne(
        {
          "data.id": msg.stream_id,
        },
        {
          $set: {
            "data.descriptors.$[descriptor].interface": msg.data.updatedDocument
              ? fromDocumentV1(msg.data.updatedDocument)
              : undefined,
            "data.descriptors.$[descriptor].serverUrls": msg.data.serverUrls,
            "metadata.version": msg.version,
          },
        },
        {
          arrayFilters: [
            {
              "descriptor.id": msg.data.descriptorId,
              $or: [
                { "descriptor.interface": { $exists: true } },
                { "descriptor.interface.id": msg.data.documentId },
              ],
            },
          ],
          ignoreUndefined: true,
        }
      );
    })
    .with(
      { type: "EServiceDeleted" },
      async (msg) => await eservices.deleteOne({ "data.id": msg.stream_id })
    )
    .with({ type: "EServiceDocumentAdded" }, async (msg) => {
      if (msg.data.isInterface) {
        await eservices.updateMany(
          { "data.id": msg.stream_id },
          {
            $set: {
              "metadata.version": msg.version,
              "data.descriptors.$[descriptor].interface": msg.data.document
                ? fromDocumentV1(msg.data.document)
                : undefined,
              "data.descriptors.$[descriptor].serverUrls": msg.data.serverUrls,
            },
          },
          {
            arrayFilters: [
              {
                "descriptor.id": msg.data.descriptorId,
              },
            ],
            ignoreUndefined: true,
          }
        );
      } else {
        await eservices.updateMany(
          { "data.id": msg.stream_id },
          {
            $set: {
              "metadata.version": msg.version,
            },
            $push: {
              "data.descriptors.$[descriptor].docs": msg.data.document
                ? fromDocumentV1(msg.data.document)
                : undefined,
            },
          },
          {
            arrayFilters: [
              {
                "descriptor.id": msg.data.descriptorId,
              },
            ],
            ignoreUndefined: true,
          }
        );
      }
    })
    .with({ type: "EServiceDocumentDeleted" }, async (msg) => {
      await eservices.updateOne(
        { "data.id": msg.stream_id },
        {
          $pull: {
            "data.descriptors.$[descriptor].docs": {
              id: msg.data.documentId,
            },
          },
          $set: {
            "metadata.version": msg.version,
          },
        },
        {
          arrayFilters: [
            {
              "descriptor.id": msg.data.descriptorId,
            },
          ],
          ignoreUndefined: true,
        }
      );
      await eservices.updateOne(
        { "data.id": msg.stream_id },
        {
          $unset: {
            "data.descriptors.$[descriptor].interface": "",
          },
          $set: {
            "data.descriptors.$[descriptor].serverUrls": [],
            "metadata.version": msg.version,
          },
        },
        {
          arrayFilters: [
            {
              "descriptor.id": msg.data.descriptorId,
              "descriptor.interface.id": msg.data.documentId,
            },
          ],
          ignoreUndefined: true,
        }
      );
    })
    .with(
      { type: "EServiceDescriptorAdded" },
      async (msg) =>
        await eservices.updateOne(
          { "data.id": msg.stream_id },
          {
            $set: {
              "metadata.version": msg.version,
            },
            $push: {
              "data.descriptors": msg.data.eServiceDescriptor
                ? fromDescriptorV1(msg.data.eServiceDescriptor)
                : undefined,
            },
          }
        )
    )
    .with(
      { type: "EServiceDescriptorUpdated" },
      async (msg) =>
        await eservices.updateMany(
          { "data.id": msg.stream_id },
          {
            $set: {
              "metadata.version": msg.version,
              "data.descriptors.$[descriptor]": msg.data.eServiceDescriptor
                ? fromDescriptorV1(msg.data.eServiceDescriptor)
                : undefined,
            },
          },
          {
            arrayFilters: [
              {
                "descriptor.id": msg.data.eServiceDescriptor?.id,
              },
            ],
            ignoreUndefined: true,
          }
        )
    )
    .with(
      { type: "MovedAttributesFromEserviceToDescriptors" },
      async (msg) =>
        await eservices.updateOne(
          { "data.id": msg.stream_id },
          {
            $set: {
              "metadata.version": msg.version,
              data: msg.data.eService
                ? fromEServiceV1(msg.data.eService)
                : undefined,
            },
          }
        )
    )
    .exhaustive();
}
