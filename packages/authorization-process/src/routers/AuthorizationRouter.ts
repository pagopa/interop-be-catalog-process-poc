import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  zodiosValidationErrorToApiProblem,
  ReadModelRepository,
  initDB,
  fromAppContext,
} from "pagopa-interop-commons";
import {
  EServiceId,
  PurposeId,
  UserId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  authorizationApi,
  selfcareV2InstitutionClientBuilder,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { authorizationServiceBuilder } from "../services/authorizationService.js";
import {
  apiClientKindToClientKind,
  clientToApiClient,
  clientToApiClientWithKeys,
  keyToApiKey,
  producerKeychainToApiProducerKeychain,
} from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  addClientUserErrorMapper,
  deleteClientErrorMapper,
  getClientsErrorMapper,
  createApiClientErrorMapper,
  createConsumerClientErrorMapper,
  deleteClientKeyByIdErrorMapper,
  getClientErrorMapper,
  getClientKeyErrorMapper,
  getClientKeysErrorMapper,
  getClientUsersErrorMapper,
  removeClientPurposeErrorMapper,
  removeClientUserErrorMapper,
  createKeysErrorMapper,
  getClientKeyWithClientErrorMapper,
  getClientsWithKeysErrorMapper,
  addClientPurposeErrorMapper,
  createProducerKeychainErrorMapper,
  getProducerKeychainsErrorMapper,
  deleteProducerKeychainErrorMapper,
  createProducerKeychainKeyErrorMapper,
  deleteProducerKeychainKeyByIdErrorMapper,
  getProducerKeychainKeysErrorMapper,
  getProducerKeychainKeyErrorMapper,
  getProducerKeychainUsersErrorMapper,
  addProducerKeychainUserErrorMapper,
  removeProducerKeychainUserErrorMapper,
  removeProducerKeychainEServiceErrorMapper,
  addPurposeKeychainEServiceErrorMapper,
  getProducerKeychainErrorMapper,
} from "../utilities/errorMappers.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const authorizationService = authorizationServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  readModelService,
  selfcareV2InstitutionClientBuilder(config)
);

const authorizationRouter = (
  ctx: ZodiosContext
): Array<ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext>> => {
  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    M2M_ROLE,
    SUPPORT_ROLE,
    API_ROLE,
    INTERNAL_ROLE,
  } = userRoles;

  const authorizationClientRouter = ctx.router(authorizationApi.clientApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  authorizationClientRouter
    .post(
      "/clientsConsumer",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { client, showUsers } =
            await authorizationService.createConsumerClient({
              clientSeed: req.body,
              organizationId: ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .send(
              authorizationApi.Client.parse(
                clientToApiClient(client, { showUsers })
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createConsumerClientErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/clientsApi",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { client, showUsers } =
            await authorizationService.createApiClient({
              clientSeed: req.body,
              organizationId: ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .send(
              authorizationApi.Client.parse(
                clientToApiClient(client, { showUsers })
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createApiClientErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/clientsWithKeys",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
        API_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { name, userIds, consumerId, purposeId, kind, offset, limit } =
            req.query;

          const parsedUserIds = (
            req.ctx.authData.userRoles.includes(userRoles.SECURITY_ROLE)
              ? [req.ctx.authData.userId]
              : userIds
          ).map(unsafeBrandId<UserId>);

          const clients = await authorizationService.getClients({
            filters: {
              name,
              userIds: parsedUserIds,
              consumerId: unsafeBrandId(consumerId),
              purposeId: purposeId
                ? unsafeBrandId<PurposeId>(purposeId)
                : undefined,
              kind: kind && apiClientKindToClientKind(kind),
            },
            authData: req.ctx.authData,
            offset,
            limit,
            logger: ctx.logger,
          });
          return res.status(200).send(
            authorizationApi.ClientsWithKeys.parse({
              results: clients.results.map((client) =>
                clientToApiClientWithKeys(client, {
                  showUsers: ctx.authData.organizationId === client.consumerId,
                })
              ),
              totalCount: clients.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientsWithKeysErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/clients",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { name, userIds, consumerId, purposeId, kind, offset, limit } =
            req.query;
          const clients = await authorizationService.getClients({
            filters: {
              name,
              userIds: userIds?.map(unsafeBrandId<UserId>),
              consumerId: unsafeBrandId(consumerId),
              purposeId: purposeId
                ? unsafeBrandId<PurposeId>(purposeId)
                : undefined,
              kind: kind && apiClientKindToClientKind(kind),
            },
            authData: req.ctx.authData,
            offset,
            limit,
            logger: ctx.logger,
          });
          return res.status(200).send(
            authorizationApi.Clients.parse({
              results: clients.results.map((client) =>
                clientToApiClient(client, {
                  showUsers: ctx.authData.organizationId === client.consumerId,
                })
              ),
              totalCount: clients.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientsErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/clients/:clientId",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { client, showUsers } =
            await authorizationService.getClientById({
              clientId: unsafeBrandId(req.params.clientId),
              organizationId: ctx.authData.organizationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .send(
              authorizationApi.Client.parse(
                clientToApiClient(client, { showUsers })
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/clients/:clientId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.deleteClient({
            clientId: unsafeBrandId(req.params.clientId),
            organizationId: ctx.authData.organizationId,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteClientErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/clients/:clientId/users",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { users } = await authorizationService.getClientUsers({
            clientId: unsafeBrandId(req.params.clientId),
            organizationId: ctx.authData.organizationId,
            logger: ctx.logger,
          });
          return res.status(200).send(authorizationApi.Users.parse(users));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientUsersErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/clients/:clientId/users/:userId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.removeClientUser({
            clientId: unsafeBrandId(req.params.clientId),
            userIdToRemove: unsafeBrandId(req.params.userId),
            organizationId: ctx.authData.organizationId,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            removeClientUserErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/clients/:clientId/users",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { client, showUsers } =
            await authorizationService.addClientUsers(
              {
                clientId: unsafeBrandId(req.params.clientId),
                userIds: req.body.userIds.map(unsafeBrandId<UserId>),
                authData: req.ctx.authData,
              },
              req.ctx.correlationId,
              ctx.logger
            );
          return res
            .status(200)
            .send(
              authorizationApi.Client.parse(
                clientToApiClient(client, { showUsers })
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addClientUserErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/clients/:clientId/keys",
      authorizationMiddleware([ADMIN_ROLE, SECURITY_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { client } = await authorizationService.createKeys({
            clientId: unsafeBrandId(req.params.clientId),
            authData: req.ctx.authData,
            keysSeeds: req.body,
            correlationId: req.ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(200).send(
            authorizationApi.Keys.parse({
              keys: client.keys.map((key) => keyToApiKey(key)),
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createKeysErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/clients/:clientId/keys",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const keys = await authorizationService.getClientKeys({
            clientId: unsafeBrandId(req.params.clientId),
            userIds: req.query.userIds.map(unsafeBrandId<UserId>),
            organizationId: ctx.authData.organizationId,
            logger: ctx.logger,
          });

          return res.status(200).send(
            authorizationApi.Keys.parse({
              keys: keys.map((key) => keyToApiKey(key)),
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientKeysErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/clients/:clientId/keys/:keyId",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const key = await authorizationService.getClientKeyById({
            clientId: unsafeBrandId(req.params.clientId),
            kid: req.params.keyId,
            organizationId: ctx.authData.organizationId,
            logger: ctx.logger,
          });

          return res
            .status(200)
            .send(authorizationApi.Key.parse(keyToApiKey(key)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientKeyErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/clients/:clientId/keys/:keyId",
      authorizationMiddleware([ADMIN_ROLE, SECURITY_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.deleteClientKeyById({
            clientId: unsafeBrandId(req.params.clientId),
            keyIdToRemove: unsafeBrandId(req.params.keyId),
            authData: ctx.authData,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteClientKeyByIdErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/clients/:clientId/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.addClientPurpose({
            clientId: unsafeBrandId(req.params.clientId),
            seed: req.body,
            ctx,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addClientPurposeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/clients/:clientId/purposes/:purposeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.removeClientPurpose({
            clientId: unsafeBrandId(req.params.clientId),
            purposeIdToRemove: unsafeBrandId(req.params.purposeId),
            organizationId: ctx.authData.organizationId,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            removeClientPurposeErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/clients/purposes/:purposeId",
      authorizationMiddleware([ADMIN_ROLE, INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.removePurposeFromClients({
            purposeIdToRemove: unsafeBrandId(req.params.purposeId),
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            () => 500,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  const authorizationUserRouter = ctx.router(authorizationApi.userApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  authorizationUserRouter.get(
    "/clients/:clientId/users/:userId/keys",
    authorizationMiddleware([ADMIN_ROLE]),
    async (_req, res) => res.status(501).send()
  );

  const authorizationProducerKeychainRouter = ctx.router(
    authorizationApi.producerKeychainApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );
  authorizationProducerKeychainRouter
    .post(
      "/producerKeychains",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { producerKeychain, showUsers } =
            await authorizationService.createProducerKeychain({
              producerKeychainSeed: req.body,
              organizationId: ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
              logger: ctx.logger,
            });
          return res.status(200).send(
            authorizationApi.ProducerKeychain.parse(
              producerKeychainToApiProducerKeychain(producerKeychain, {
                showUsers,
              })
            )
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createProducerKeychainErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/producerKeychains",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { name, userIds, producerId, eserviceId, offset, limit } =
            req.query;
          const producerKeychains =
            await authorizationService.getProducerKeychains({
              filters: {
                name,
                userIds: userIds?.map(unsafeBrandId<UserId>),
                producerId: unsafeBrandId(producerId),
                eserviceId: eserviceId
                  ? unsafeBrandId<EServiceId>(eserviceId)
                  : undefined,
              },
              authData: req.ctx.authData,
              offset,
              limit,
              logger: ctx.logger,
            });
          return res.status(200).send(
            authorizationApi.ProducerKeychains.parse({
              results: producerKeychains.results.map((producerKeychain) =>
                producerKeychainToApiProducerKeychain(producerKeychain, {
                  showUsers:
                    ctx.authData.organizationId === producerKeychain.producerId,
                })
              ),
              totalCount: producerKeychains.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getProducerKeychainsErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/producerKeychains/:producerKeychainId",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { producerKeychain, showUsers } =
            await authorizationService.getProducerKeychainById({
              producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
              organizationId: ctx.authData.organizationId,
              logger: ctx.logger,
            });
          return res.status(200).send(
            authorizationApi.ProducerKeychain.parse(
              producerKeychainToApiProducerKeychain(producerKeychain, {
                showUsers,
              })
            )
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getProducerKeychainErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/producerKeychains/:producerKeychainId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.deleteProducerKeychain({
            producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
            organizationId: ctx.authData.organizationId,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteProducerKeychainErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/producerKeychains/:producerKeychainId/users",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const users = await authorizationService.getProducerKeychainUsers({
            producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
            organizationId: ctx.authData.organizationId,
            logger: ctx.logger,
          });
          return res.status(200).send(authorizationApi.Users.parse(users));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getProducerKeychainUsersErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/producerKeychains/:producerKeychainId/users",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { producerKeychain, showUsers } =
            await authorizationService.addProducerKeychainUsers(
              {
                producerKeychainId: unsafeBrandId(
                  req.params.producerKeychainId
                ),
                userIds: req.body.userIds.map(unsafeBrandId<UserId>),
                authData: req.ctx.authData,
              },
              req.ctx.correlationId,
              ctx.logger
            );
          return res.status(200).send(
            authorizationApi.ProducerKeychain.parse(
              producerKeychainToApiProducerKeychain(producerKeychain, {
                showUsers,
              })
            )
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addProducerKeychainUserErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/producerKeychains/:producerKeychainId/users/:userId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.removeProducerKeychainUser({
            producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
            userIdToRemove: unsafeBrandId(req.params.userId),
            organizationId: ctx.authData.organizationId,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            removeProducerKeychainUserErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/producerKeychains/:producerKeychainId/keys",
      authorizationMiddleware([ADMIN_ROLE, SECURITY_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const producerKeychain =
            await authorizationService.createProducerKeychainKey({
              producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
              authData: req.ctx.authData,
              keySeed: req.body,
              correlationId: req.ctx.correlationId,
              logger: ctx.logger,
            });
          return res.status(200).send(
            authorizationApi.Keys.parse({
              keys: producerKeychain.keys.map(keyToApiKey),
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createProducerKeychainKeyErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/producerKeychains/:producerKeychainId/keys",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const keys = await authorizationService.getProducerKeychainKeys({
            producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
            userIds: req.query.userIds.map(unsafeBrandId<UserId>),
            organizationId: ctx.authData.organizationId,
            logger: ctx.logger,
          });

          return res
            .status(200)
            .send(authorizationApi.Keys.parse({ keys: keys.map(keyToApiKey) }));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getProducerKeychainKeysErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/producerKeychains/:producerKeychainId/keys/:keyId",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const key = await authorizationService.getProducerKeychainKeyById({
            producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
            kid: req.params.keyId,
            organizationId: ctx.authData.organizationId,
            logger: ctx.logger,
          });

          return res
            .status(200)
            .send(authorizationApi.Key.parse(keyToApiKey(key)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getProducerKeychainKeyErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/producerKeychains/:producerKeychainId/keys/:keyId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.removeProducerKeychainKeyById({
            producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
            keyIdToRemove: unsafeBrandId(req.params.keyId),
            authData: ctx.authData,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteProducerKeychainKeyByIdErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/producerKeychains/:producerKeychainId/eservices",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.addProducerKeychainEService({
            producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
            seed: req.body,
            organizationId: ctx.authData.organizationId,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addPurposeKeychainEServiceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/producerKeychains/:producerKeychainId/eservices/:eserviceId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.removeProducerKeychainEService({
            producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
            eserviceIdToRemove: unsafeBrandId(req.params.eserviceId),
            organizationId: ctx.authData.organizationId,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            removeProducerKeychainEServiceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  const tokenGenerationRouter = ctx.router(
    authorizationApi.tokenGenerationApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  tokenGenerationRouter.get(
    "/clients/:clientId/keys/:keyId/bundle",
    authorizationMiddleware([
      ADMIN_ROLE,
      SECURITY_ROLE,
      M2M_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        const { key: jwkKey, client } =
          await authorizationService.getKeyWithClientByKeyId({
            clientId: unsafeBrandId(req.params.clientId),
            kid: req.params.keyId,
            logger: ctx.logger,
          });
        return res.status(200).send(
          authorizationApi.KeyWithClient.parse({
            key: jwkKey,
            client,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getClientKeyWithClientErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );
  return [
    authorizationClientRouter,
    authorizationUserRouter,
    authorizationProducerKeychainRouter,
    tokenGenerationRouter,
  ];
};
export default authorizationRouter;
