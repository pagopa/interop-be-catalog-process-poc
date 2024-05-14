/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, expect, it, vi } from "vitest";
import {
  getMockPurposeVersion,
  getMockPurpose,
  writeInReadmodel,
  readLastEventByStreamId,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test";
import {
  PurposeVersion,
  purposeVersionState,
  Purpose,
  toReadModelEService,
  generateId,
  PurposeVersionSuspendedByConsumerV2,
  toPurposeV2,
  PurposeVersionSuspendedByProducerV2,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import {
  purposeNotFound,
  purposeVersionNotFound,
  organizationNotAllowed,
  notValidVersionState,
} from "../src/model/domain/errors.js";
import { addOnePurpose, getMockEService } from "./utils.js";
import {
  postgresDB,
  purposes,
  eservices,
  purposeService,
} from "./purposeService.integration.test.js";

export const testSuspendPurposeVersion = (): ReturnType<typeof describe> =>
  describe("suspendPurposeVersion", () => {
    it("should write on event-store for the suspension of a purpose version by the consumer", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockEService = getMockEService();
      const mockPurposeVersion1: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.active,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion1],
      };
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      await purposeService.suspendPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
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
        type: "PurposeVersionSuspendedByConsumer",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          {
            ...mockPurposeVersion1,
            state: purposeVersionState.suspended,
            suspendedAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        updatedAt: new Date(),
        suspendedByConsumer: true,
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeVersionSuspendedByConsumerV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

      vi.useRealTimers();
    });
    it("should write on event-store for the suspension of a purpose version by the producer", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockEService = getMockEService();
      const mockPurposeVersion1: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.active,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion1],
      };
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      await purposeService.suspendPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
        organizationId: mockEService.producerId,
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
        type: "PurposeVersionSuspendedByProducer",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          {
            ...mockPurposeVersion1,
            state: purposeVersionState.suspended,
            suspendedAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        suspendedByProducer: true,
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeVersionSuspendedByProducerV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

      vi.useRealTimers();
    });
    it("should write on event-store for the suspension of a purpose version by the producer (self consumer)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const mockEService = getMockEService();
      const mockPurposeVersion1: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.active,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        consumerId: mockEService.producerId,
        versions: [mockPurposeVersion1],
      };
      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      await purposeService.suspendPurposeVersion({
        purposeId: mockPurpose.id,
        versionId: mockPurposeVersion1.id,
        organizationId: mockEService.producerId,
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
        type: "PurposeVersionSuspendedByProducer",
        event_version: 2,
      });

      const expectedPurpose: Purpose = {
        ...mockPurpose,
        versions: [
          {
            ...mockPurposeVersion1,
            state: purposeVersionState.suspended,
            suspendedAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        suspendedByProducer: true,
        updatedAt: new Date(),
      };

      const writtenPayload = decodeProtobufPayload({
        messageType: PurposeVersionSuspendedByProducerV2,
        payload: writtenEvent.data,
      });

      expect(writtenPayload.purpose).toEqual(toPurposeV2(expectedPurpose));

      vi.useRealTimers();
    });
    it("should throw purposeNotFound if the purpose doesn't exist", async () => {
      const randomPurposeId: PurposeId = generateId();
      const randomVersionId: PurposeVersionId = generateId();
      const mockPurpose = getMockPurpose();
      await addOnePurpose(mockPurpose, postgresDB, purposes);

      expect(
        purposeService.suspendPurposeVersion({
          purposeId: randomPurposeId,
          versionId: randomVersionId,
          organizationId: generateId(),
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(purposeNotFound(randomPurposeId));
    });
    it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
      const mockEService = getMockEService();
      const randomVersionId: PurposeVersionId = generateId();

      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.suspendPurposeVersion({
          purposeId: mockPurpose.id,
          versionId: randomVersionId,
          organizationId: mockPurpose.consumerId,
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(
        purposeVersionNotFound(mockPurpose.id, randomVersionId)
      );
    });
    it("should throw organizationNotAllowed if the requester is not the producer nor the consumer", async () => {
      const mockEService = getMockEService();
      const randomId: TenantId = generateId();
      const mockPurposeVersion: PurposeVersion = {
        ...getMockPurposeVersion(),
        state: purposeVersionState.active,
      };
      const mockPurpose: Purpose = {
        ...getMockPurpose(),
        eserviceId: mockEService.id,
        versions: [mockPurposeVersion],
      };

      await addOnePurpose(mockPurpose, postgresDB, purposes);
      await writeInReadmodel(toReadModelEService(mockEService), eservices);

      expect(
        purposeService.suspendPurposeVersion({
          purposeId: mockPurpose.id,
          versionId: mockPurposeVersion.id,
          organizationId: randomId,
          correlationId: generateId(),
          logger: genericLogger,
        })
      ).rejects.toThrowError(organizationNotAllowed(randomId));
    });
    it.each(
      Object.values(purposeVersionState).filter(
        (state) =>
          state !== purposeVersionState.active &&
          state !== purposeVersionState.suspended
      )
    )(
      "should throw notValidVersionState if the purpose version is in %s state",
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
          purposeService.suspendPurposeVersion({
            purposeId: mockPurpose.id,
            versionId: mockPurposeVersion.id,
            organizationId: mockPurpose.consumerId,
            correlationId: generateId(),
            logger: genericLogger,
          })
        ).rejects.toThrowError(
          notValidVersionState(mockPurposeVersion.id, mockPurposeVersion.state)
        );
      }
    );
  });
