/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it } from "vitest";
import {
  DraftPurposeDeletedV2,
  Purpose,
  PurposeId,
  PurposeVersion,
  WaitingForApprovalPurposeDeletedV2,
  generateId,
  purposeVersionState,
  toPurposeV2,
  toReadModelEService,
} from "pagopa-interop-models";
import {
  getMockPurpose,
  writeInReadmodel,
  readLastEventByStreamId,
  decodeProtobufPayload,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  organizationIsNotTheConsumer,
  purposeCannotBeDeleted,
} from "../src/model/domain/errors.js";
import {
  eservices,
  postgresDB,
  purposeService,
  purposes,
} from "./purposeService.integration.test.js";
import { addOnePurpose, getMockEService } from "./utils.js";

export const testDeletePurpose = (): ReturnType<typeof describe> =>
  describe("deletePurpose", () => {
    it("should write on event-store for the deletion of a purpose (no versions)", async () => {
      const mockEService = getMockEService();
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      await purposeService.deletePurpose({
        purposeId: mockPurpose.id,
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      });

      const writtenEvent = await readLastEventByStreamId(
        mockPurpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "DraftPurposeDeleted",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: DraftPurposeDeletedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
    });
    it("should write on event-store for the deletion of a purpose (draft version)", async () => {
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion(
        purposeVersionState.draft
      );
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      await purposeService.deletePurpose({
        purposeId: mockPurpose.id,
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      });

      const writtenEvent = await readLastEventByStreamId(
        mockPurpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "DraftPurposeDeleted",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: DraftPurposeDeletedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
    });
    it("should write on event-store for the deletion of a purpose (waitingForApproval version)", async () => {
      const mockEService = getMockEService();
      const mockPurposeVersion = getMockPurposeVersion(
        purposeVersionState.waitingForApproval
      );
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      await purposeService.deletePurpose({
        purposeId: mockPurpose.id,
        organizationId: mockPurpose.consumerId,
        correlationId: generateId(),
        logger: genericLogger,
      });

      const writtenEvent = await readLastEventByStreamId(
        mockPurpose.id,
        "purpose",
        postgresDB
      );

      expect(writtenEvent).toMatchObject({
        stream_id: mockPurpose.id,
        version: "1",
        type: "WaitingForApprovalPurposeDeleted",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: WaitingForApprovalPurposeDeletedV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(mockPurpose));
    });
    it("should throw purposeNotFound if the purpose doesn't exist", async () => {
      const randomId: PurposeId = generateId();
      const mockPurpose = getMockPurpose();

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      expect(
        purposeService.deletePurpose({
          purposeId: randomId,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(purposeNotFound(randomId));
    });
    it("should throw organizationIsNotTheConsumer if the requester is not the consumer", async () => {
      const mockEService = getMockEService();
      const mockPurposeVersion: PurposeVersion = getMockPurposeVersion(
        purposeVersionState.draft
      );
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.deletePurpose({
          purposeId: mockPurpose.id,
          organizationId: mockEService.producerId,
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        organizationIsNotTheConsumer(mockEService.producerId)
      );
    });
    it.each(
      Object.values(purposeVersionState).filter(
        (state) =>
          state !== purposeVersionState.waitingForApproval &&
          state !== purposeVersionState.draft
      )
    )(
      "should throw purposeCannotBeDeleted if the purpose has a $s version ",
      async (state) => {
        const mockEService = getMockEService();
        const mockPurposeVersion = getMockPurposeVersion(state);

        const mockPurpose: Purpose = {
          ...getMockPurpose(),
          eserviceId: mockEService.id,
          versions: [mockPurposeVersion],
        };

        await addOnePurpose(mockPurpose, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.deletePurpose({
            purposeId: mockPurpose.id,
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
            logger: genericLogger,
          })
        ).rejects.toThrowError(purposeCannotBeDeleted(mockPurpose.id));
      }
    );
  });
