import { fail } from "assert";
import {
  Agreement,
  AgreementArchivedByConsumerV2,
  AgreementId,
  AgreementV2,
  EServiceId,
  TenantId,
  agreementState,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { describe, expect, it, vi } from "vitest";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  operationNotAllowed,
} from "../src/model/domain/errors.js";
import { agreementArchivableStates } from "../src/model/domain/validators.js";
import { addOneAgreement, readLastAgreementEvent } from "./utils.js";
import {
  agreementService,
  agreements,
  postgresDB,
} from "./agreementService.integration.test.js";

export const testArchiveAgreement = (): ReturnType<typeof describe> =>
  describe("archive agreement", () => {
    it("should succeed when the requester is the consumer and the agreement is in an archivable state", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const authData = getRandomAuthData();
      const eserviceId = generateId<EServiceId>();

      const agreement = getMockAgreement(
        eserviceId,
        authData.organizationId,
        randomArrayItem(agreementArchivableStates)
      );

      await addOneAgreement(agreement, postgresDB, agreements);

      const agreementId = await agreementService.archiveAgreement(
        agreement.id,
        { authData, serviceName: "", correlationId: "", logger: genericLogger }
      );

      expect(agreementId).toBeDefined();
      if (!agreementId) {
        fail("Unhandled error: returned agreementId is undefined");
      }

      const actualAgreementData = await readLastAgreementEvent(
        agreementId,
        postgresDB
      );

      if (!actualAgreementData) {
        fail("Creation fails: agreement not found in event-store");
      }

      expect(actualAgreementData).toMatchObject({
        type: "AgreementArchivedByConsumer",
        event_version: 2,
        version: "1",
        stream_id: agreementId,
      });

      const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
        messageType: AgreementArchivedByConsumerV2,
        payload: actualAgreementData.data,
      }).agreement;

      if (!actualAgreement) {
        fail("impossible to decode AgreementArchivedV2 data");
      }

      const expectedAgreemenentArchived: Agreement = {
        ...agreement,
        state: agreementState.archived,
        stamps: {
          ...agreement.stamps,
          archiving: {
            who: authData.userId,
            when: new Date(),
          },
        },
      };
      expect(actualAgreement).toMatchObject(
        toAgreementV2(expectedAgreemenentArchived)
      );

      vi.useRealTimers();
    });

    it("should throw a agreementNotFound error when the Agreement doesn't exist", async () => {
      const authData = getRandomAuthData();
      const eserviceId = generateId<EServiceId>();

      const agreement = getMockAgreement(
        eserviceId,
        authData.organizationId,
        randomArrayItem(agreementArchivableStates)
      );

      await addOneAgreement(agreement, postgresDB, agreements);

      const agreementToArchiveId = generateId<AgreementId>();

      await expect(
        agreementService.archiveAgreement(agreementToArchiveId, {
          authData,
          serviceName: "",
          correlationId: "",
          logger: genericLogger,
        })
      ).rejects.toThrowError(agreementNotFound(agreementToArchiveId));
    });

    it("should throw a operationNotAllowed error when the requester is not the Agreement consumer", async () => {
      const authData = getRandomAuthData();
      const eserviceId = generateId<EServiceId>();

      const agreement = getMockAgreement(
        eserviceId,
        generateId<TenantId>(),
        randomArrayItem(agreementArchivableStates)
      );

      await addOneAgreement(agreement, postgresDB, agreements);

      await expect(
        agreementService.archiveAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: "",
          logger: genericLogger,
        })
      ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
    });

    it("should throw a agreementNotInExpectedState error when the Agreement is not in a archivable states", async () => {
      const authData = getRandomAuthData();
      const eserviceId = generateId<EServiceId>();

      const notArchivableState = randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementArchivableStates.includes(s)
        )
      );
      const agreement = getMockAgreement(
        eserviceId,
        authData.organizationId,
        notArchivableState
      );

      await addOneAgreement(agreement, postgresDB, agreements);

      await expect(
        agreementService.archiveAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: "",
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        agreementNotInExpectedState(agreement.id, notArchivableState)
      );
    });
  });
