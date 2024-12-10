import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
  getMockTenantMail,
} from "pagopa-interop-commons-test";
import {
  Tenant,
  UserId,
  generateId,
  tenantMailKind,
  toAgreementV2,
} from "pagopa-interop-models";
import { afterEach, beforeAll, describe, expect, it, vi, vitest } from "vitest";
import {
  agreementStampDateNotFound,
  descriptorNotFound,
  eServiceNotFound,
  tenantDigitalAddressNotFound,
  tenantNotFound,
} from "../src/models/errors.js";
import {
  agreementEventMailTemplateType,
  getFormattedAgreementStampDate,
} from "../src/services/agreementEmailSenderService.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  agreementEmailSenderService,
  agreementEmailSenderServiceFailure,
  emailManager,
  interopFeBaseUrl,
  pecEmailsenderData,
  sesEmailManager,
  sesEmailsenderData,
  templateService,
} from "./utils.js";

beforeAll(() => {
  vitest.clearAllMocks();
});

afterEach(() => {
  vitest.clearAllMocks();
});

describe("sendAgreementActivationEmail", () => {
  describe("Send Notification Email", () => {
    it("should send an email to Consumer to contact email addresses", async () => {
      const consumerEmail = getMockTenantMail(tenantMailKind.ContactEmail);
      const consumer: Tenant = {
        ...getMockTenant(),
        mails: [consumerEmail],
      };
      const producer: Tenant = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };

      await addOneTenant(consumer);
      await addOneTenant(producer);

      const descriptor = getMockDescriptor();
      const eservice = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      const agreement = {
        ...getMockAgreement(),
        stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
        producerId: producer.id,
        descriptorId: descriptor.id,
        eserviceId: eservice.id,
        consumerId: consumer.id,
      };
      await addOneAgreement(agreement);

      await agreementEmailSenderService.sendAgreementActivationNotificationEmail(
        toAgreementV2(agreement),
        genericLogger
      );

      const filename = fileURLToPath(import.meta.url);
      const dirname = path.dirname(filename);
      const templatePath = `../src/resources/templates/${agreementEventMailTemplateType.activation}.html`;

      const htmlTemplateBuffer = await fs.readFile(
        `${dirname}/${templatePath}`
      );
      const activationNotificationEmailTemplate = htmlTemplateBuffer.toString();

      const mail = {
        from: {
          name: sesEmailsenderData.label,
          address: sesEmailsenderData.mail,
        },
        subject: `Richiesta di fruizione ${agreement.id} attiva`,
        to: [consumerEmail.address],
        body: templateService.compileHtml(activationNotificationEmailTemplate, {
          interopFeUrl: interopFeBaseUrl,
          producerName: producer.name,
          consumerName: consumer.name,
          eserviceName: eservice.name,
          activationDate: getFormattedAgreementStampDate(
            agreement,
            "activation"
          ),
        }),
      };

      expect(sesEmailManager.send).toHaveBeenCalledWith(
        mail.from,
        mail.to,
        mail.subject,
        mail.body
      );
    });

    it("should throw agreementStampDateNotFound for activation date not found", async () => {
      vi.spyOn(sesEmailManager, "send");
      const consumer = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      const producer = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      const agreement = {
        ...getMockAgreement(),
        stamps: {},
        consumerId: consumer.id,
        producerId: producer.id,
      };
      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneAgreement(agreement);

      await expect(
        agreementEmailSenderService.sendAgreementActivationNotificationEmail(
          toAgreementV2(agreement),
          genericLogger
        )
      ).rejects.toThrowError(
        agreementStampDateNotFound("activation", agreement.id)
      );
      expect(sesEmailManager.send).not.toHaveBeenCalled();
    });

    it("should throw eServiceNotFound for Eservice not found", async () => {
      vi.spyOn(sesEmailManager, "send");
      const consumer = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      const producer = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      const agreement = {
        ...getMockAgreement(),
        stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
        producerId: producer.id,
        consumerId: consumer.id,
      };
      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneAgreement(agreement);

      await expect(
        agreementEmailSenderService.sendAgreementActivationNotificationEmail(
          toAgreementV2(agreement),
          genericLogger
        )
      ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));

      expect(sesEmailManager.send).not.toHaveBeenCalled();
    });

    it("should throw tenantNotFound for Producer not found", async () => {
      vi.spyOn(sesEmailManager, "send");
      const eservice = getMockEService();
      const consumer = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      const producer = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      await addOneEService(eservice);
      const agreement = {
        ...getMockAgreement(),
        stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
        eserviceId: eservice.id,
        consumerId: consumer.id,
        producerId: producer.id,
      };

      await addOneTenant(consumer);
      await addOneAgreement(agreement);

      await expect(
        agreementEmailSenderService.sendAgreementActivationNotificationEmail(
          toAgreementV2(agreement),
          genericLogger
        )
      ).rejects.toThrowError(tenantNotFound(agreement.producerId));
      expect(sesEmailManager.send).not.toHaveBeenCalled();
    });

    it("should throw tenantNotFound for Consumer not found", async () => {
      vi.spyOn(sesEmailManager, "send");
      const consumer = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      const producer = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      await addOneTenant(producer);

      const eservice = getMockEService();
      await addOneEService(eservice);

      const agreement = {
        ...getMockAgreement(),
        stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
        eserviceId: eservice.id,
        producerId: producer.id,
        consumerId: consumer.id,
      };
      await addOneAgreement(agreement);

      await expect(
        agreementEmailSenderService.sendAgreementActivationNotificationEmail(
          toAgreementV2(agreement),
          genericLogger
        )
      ).rejects.toThrowError(tenantNotFound(agreement.consumerId));

      expect(sesEmailManager.send).not.toHaveBeenCalled();
    });

    it("should throw tenantDigitalAddressNotFound for Consumer digital address not found", async () => {
      vi.spyOn(sesEmailManager, "send");
      const producer = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      const consumer = getMockTenant();
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = getMockEService();
      await addOneEService(eservice);

      const agreement = {
        ...getMockAgreement(),
        stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
        eserviceId: eservice.id,
        producerId: producer.id,
        consumerId: consumer.id,
      };
      await addOneAgreement(agreement);

      await expect(
        agreementEmailSenderService.sendAgreementActivationNotificationEmail(
          toAgreementV2(agreement),
          genericLogger
        )
      ).rejects.toThrowError(
        tenantDigitalAddressNotFound(agreement.consumerId)
      );

      expect(sesEmailManager.send).not.toHaveBeenCalled();
    });

    it("should throw descriptorNotFound for Descriptor not found", async () => {
      vi.spyOn(sesEmailManager, "send");
      const producer = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      const consumer = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.ContactEmail)],
      };
      await addOneTenant(producer);
      await addOneTenant(consumer);

      const eservice = getMockEService();
      await addOneEService(eservice);

      const agreement = {
        ...getMockAgreement(),
        stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
        eserviceId: eservice.id,
        producerId: producer.id,
        consumerId: consumer.id,
      };
      await addOneAgreement(agreement);

      await expect(
        agreementEmailSenderService.sendAgreementActivationNotificationEmail(
          toAgreementV2(agreement),
          genericLogger
        )
      ).rejects.toThrowError(
        descriptorNotFound(agreement.eserviceId, agreement.descriptorId)
      );

      expect(sesEmailManager.send).not.toHaveBeenCalled();
    });

    it("should fail when email manager send fails", async () => {
      vi.spyOn(sesEmailManager, "send");
      const consumer: Tenant = {
        ...getMockTenant(),
        mails: [
          {
            ...getMockTenantMail(tenantMailKind.ContactEmail),
            address: "invalid email address",
          },
        ],
      };
      const producer: Tenant = {
        ...getMockTenant(),
        mails: [
          {
            ...getMockTenantMail(tenantMailKind.ContactEmail),
            address: "invalid email address",
          },
        ],
      };

      await addOneTenant(consumer);
      await addOneTenant(producer);

      const descriptor = getMockDescriptor();
      const eservice = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      const agreement = {
        ...getMockAgreement(),
        stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
        producerId: producer.id,
        descriptorId: descriptor.id,
        eserviceId: eservice.id,
        consumerId: consumer.id,
      };
      await addOneAgreement(agreement);

      await agreementEmailSenderServiceFailure.sendAgreementActivationNotificationEmail(
        toAgreementV2(agreement),
        genericLogger
      );

      expect(sesEmailManager.send).not.toHaveBeenCalled();
    });
  });

  describe("Send Certified Email", () => {
    it("should send an email to Producer and Consumer digital addresses", async () => {
      vi.spyOn(emailManager, "send");
      const consumerEmail = getMockTenantMail(tenantMailKind.DigitalAddress);
      const consumer: Tenant = {
        ...getMockTenant(),
        mails: [consumerEmail],
      };
      const producerEmail = getMockTenantMail(tenantMailKind.DigitalAddress);
      const producer: Tenant = {
        ...getMockTenant(),
        mails: [producerEmail],
      };

      await addOneTenant(consumer);
      await addOneTenant(producer);

      const descriptor = getMockDescriptor();
      const eservice = {
        ...getMockEService(),
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      const agreement = {
        ...getMockAgreement(),
        stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
        producerId: producer.id,
        descriptorId: descriptor.id,
        eserviceId: eservice.id,
        consumerId: consumer.id,
      };
      await addOneAgreement(agreement);

      await agreementEmailSenderService.sendAgreementActivationCertifiedEmail(
        toAgreementV2(agreement),
        genericLogger
      );

      const filename = fileURLToPath(import.meta.url);
      const dirname = path.dirname(filename);
      const templatePath = `../src/resources/templates/${agreementEventMailTemplateType.activationPEC}.html`;

      const htmlTemplateBuffer = await fs.readFile(
        `${dirname}/${templatePath}`
      );
      const activationNotificationEmailTemplate = htmlTemplateBuffer.toString();

      const mail = {
        from: {
          name: pecEmailsenderData.label,
          address: pecEmailsenderData.mail,
        },
        subject: `Richiesta di fruizione ${agreement.id} attiva`,
        to: [consumerEmail.address, producerEmail.address],
        body: templateService.compileHtml(activationNotificationEmailTemplate, {
          activationDate: getFormattedAgreementStampDate(
            agreement,
            "activation"
          ),
          agreementId: agreement.id,
          eserviceName: eservice.name,
          eserviceVersion: descriptor.version,
          producerName: producer.name,
          consumerName: consumer.name,
          interopFeUrl: interopFeBaseUrl,
        }),
      };

      expect(emailManager.send).toHaveBeenCalledWith(
        mail.from,
        mail.to,
        mail.subject,
        mail.body
      );
    });

    it("should throw tenantDigitalAddressNotFound for Producer digital address not found", async () => {
      const producer = { ...getMockTenant(), mails: [] };

      await addOneTenant(producer);

      const consumer = {
        ...getMockTenant(),
        mails: [getMockTenantMail(tenantMailKind.DigitalAddress)],
      };
      await addOneTenant(consumer);

      const eservice = getMockEService();
      await addOneEService(eservice);

      const agreement = {
        ...getMockAgreement(),
        stamps: { activation: { when: new Date(), who: generateId<UserId>() } },
        eserviceId: eservice.id,
        producerId: producer.id,
        consumerId: consumer.id,
      };
      await addOneAgreement(agreement);

      await expect(
        agreementEmailSenderService.sendAgreementActivationCertifiedEmail(
          toAgreementV2(agreement),
          genericLogger
        )
      ).rejects.toThrowError(
        tenantDigitalAddressNotFound(agreement.producerId)
      );

      expect(sesEmailManager.send).not.toHaveBeenCalled();
    });
  });
});
