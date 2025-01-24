/* eslint-disable no-irregular-whitespace */
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
  Agreement,
  AgreementId,
  EService,
  Tenant,
  UserId,
  generateId,
  tenantMailKind,
  toAgreementV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import axios, { AxiosResponse } from "axios";
import {
  agreementEventMailTemplateType,
  getFormattedAgreementStampDate,
} from "../src/services/agreementEmailSenderService.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  agreementEmailSenderService,
  interopFeBaseUrl,
  sesEmailManager,
  sesEmailManagerConfig,
  sesEmailsenderData,
  templateService,
} from "./utils.js";

describe("sendAgreementRejectEmail", () => {
  it("should send an email on AgreementRejected", async () => {
    vi.spyOn(sesEmailManager, "send");
    const consumerEmail = getMockTenantMail(tenantMailKind.ContactEmail);
    const consumer: Tenant = {
      ...getMockTenant(),
      name: "Jane Doe",
      mails: [consumerEmail],
    };
    const producer: Tenant = getMockTenant();

    await addOneTenant(producer);
    await addOneTenant(consumer);

    const descriptor = getMockDescriptor();
    const eservice: EService = {
      ...getMockEService(),
      name: "EService",
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const rejectDate = new Date("2021-01-01");

    const agreement = {
      ...getMockAgreement(),
      id: "37317757-0c8d-4e6e-9ac9-7d2db6a9519e" as AgreementId,
      stamps: {
        rejection: { when: rejectDate, who: generateId<UserId>() },
      },
      producerId: producer.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);

    await agreementEmailSenderService.sendAgreementRejectSimpleEmail(
      toAgreementV2(agreement),
      genericLogger
    );

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const templatePath = `../src/resources/templates/${agreementEventMailTemplateType.rejection}.html`;

    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    const rejectEmailTemplate = htmlTemplateBuffer.toString();

    const mail = {
      from: {
        name: sesEmailsenderData.label,
        address: sesEmailsenderData.mail,
      },
      subject: `Richiesta di fruizione per ${eservice.name} rifiutata`,
      to: [consumerEmail.address],
      body: templateService.compileHtml(rejectEmailTemplate, {
        interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/richieste/${agreement.id}`,
        producerName: producer.name,
        consumerName: consumer.name,
        eserviceName: eservice.name,
        rejectionDate: getFormattedAgreementStampDate(agreement, "rejection"),
      }),
    };

    expect(sesEmailManager.send).toHaveBeenCalledWith(
      mail.from,
      mail.to,
      mail.subject,
      mail.body
    );

    const response: AxiosResponse = await axios.get(
      `${sesEmailManagerConfig?.awsSesEndpoint}/store`
    );
    expect(response.status).toBe(200);
    const lastEmail = response.data.emails[0];
    expect(lastEmail).toBeDefined();
    expect(lastEmail.subject).toBe(mail.subject);
    expect(lastEmail.from).toBe(`${mail.from.name} <${mail.from.address}>`);
    expect(lastEmail.destination.to).toEqual(mail.to);
    expect(lastEmail.body.html).toBe(mail.body);
  });

  it("should should not send email if the producer has no mail", async () => {
    vi.spyOn(sesEmailManager, "send");
    const consumer: Tenant = { ...getMockTenant(), name: "Jane Doe" };
    const producer: Tenant = {
      ...getMockTenant(),
      name: "John Doe",
      mails: [],
    };
    await addOneTenant(producer);
    await addOneTenant(consumer);

    const descriptor = getMockDescriptor();
    const eservice: EService = {
      ...getMockEService(),
      name: "EService",
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    const agreement: Agreement = {
      ...getMockAgreement(),
      stamps: { submission: { when: new Date(), who: generateId<UserId>() } },
      producerId: producer.id,
      descriptorId: descriptor.id,
      eserviceId: eservice.id,
      consumerId: consumer.id,
    };
    await addOneAgreement(agreement);

    await agreementEmailSenderService.sendAgreementSubmissionSimpleEmail(
      toAgreementV2(agreement),
      genericLogger
    );

    expect(sesEmailManager.send).not.toHaveBeenCalled();
  });
});
