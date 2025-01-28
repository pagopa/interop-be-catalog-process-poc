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
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementId,
  EService,
  Tenant,
  UserId,
  generateId,
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

describe("sendAgreementSubmissionEmail", () => {
  it("should send an email on AgreementSubmitted", async () => {
    vi.spyOn(sesEmailManager, "send");
    const tenantMail = "tenant@mail.com";
    const consumer: Tenant = { ...getMockTenant(), name: "Jane Doe" };
    const producer: Tenant = {
      ...getMockTenant(),
      name: "John Doe",
      mails: [
        {
          address: "oldmail@old.com",
          id: generateId(),
          createdAt: new Date("2021-01-01"),
          kind: "CONTACT_EMAIL",
        },
        {
          address: tenantMail,
          id: generateId(),
          createdAt: new Date(),
          kind: "CONTACT_EMAIL",
        },
        {
          address: "oldmail2@old.com",
          id: generateId(),
          createdAt: new Date("2020-01-01"),
          kind: "CONTACT_EMAIL",
        },
      ],
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

    const submissionDate = new Date("2021-01-01");

    const agreement = {
      ...getMockAgreement(),
      id: "37317757-0c8d-4e6e-9ac9-7d2db6a9519e" as AgreementId,
      stamps: {
        submission: { when: submissionDate, who: generateId<UserId>() },
      },
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

    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const templatePath = `../src/resources/templates/${agreementEventMailTemplateType.submission}.html`;

    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    const submissionEmailTemplate = htmlTemplateBuffer.toString();

    const mail = {
      from: {
        name: sesEmailsenderData.label,
        address: sesEmailsenderData.mail,
      },
      subject: `Nuova richiesta di fruizione per ${eservice.name} ricevuta`,
      to: [tenantMail],
      body: templateService.compileHtml(submissionEmailTemplate, {
        interopFeUrl: `https://${interopFeBaseUrl}/ui/it/erogazione/richieste/${agreement.id}`,
        producerName: producer.name,
        consumerName: consumer.name,
        eserviceName: eservice.name,
        submissionDate: getFormattedAgreementStampDate(agreement, "submission"),
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
