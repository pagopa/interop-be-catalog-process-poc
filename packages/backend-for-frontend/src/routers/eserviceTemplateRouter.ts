import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import {
  ExpressContext,
  FileManager,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { eserviceTemplateServiceBuilder } from "../services/eserviceTemplateService.js";
import { fromBffAppContext } from "../utilities/context.js";
import { emptyErrorMapper, makeApiProblem } from "../model/errors.js";

const eserviceTemplateRouter = (
  ctx: ZodiosContext,
  { eserviceTemplateProcessClient }: PagoPAInteropBeClients,
  fileManager: FileManager
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eserviceTemplateRouter = ctx.router(bffApi.eserviceTemplatesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const eserviceTemplateService = eserviceTemplateServiceBuilder(
    eserviceTemplateProcessClient,
    fileManager
  );

  eserviceTemplateRouter
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/suspend",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId, eServiceTemplateVersionId } = req.params;

        try {
          await eserviceTemplateService.suspendEServiceTemplateVersion(
            unsafeBrandId(eServiceTemplateId),
            unsafeBrandId(eServiceTemplateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
            `Error suspending version ${eServiceTemplateVersionId} for eservice template ${eServiceTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/activate",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId, eServiceTemplateVersionId } = req.params;

        try {
          await eserviceTemplateService.activateEServiceTemplateVersion(
            unsafeBrandId(eServiceTemplateId),
            unsafeBrandId(eServiceTemplateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
            `Error activating version ${eServiceTemplateVersionId} for eservice template ${eServiceTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return eserviceTemplateRouter;
};

export default eserviceTemplateRouter;
