import {
  ReadModelRepository,
  initSesMailManager,
  logger,
  withExecutionTime,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { config } from "./configs/config.js";
import { ReadModelQueriesClient } from "./services/readModelQueriesService.js";
import { toCSV, toCsvDataRow } from "./utils/helpersUtils.js";
import { CSV_FILENAME, MAIL_BODY, MAIL_SUBJECT } from "./configs/constants.js";

const loggerInstance = logger({
  serviceName: "pn-consumers",
  correlationId: uuidv4(),
});

async function main(): Promise<void> {
  loggerInstance.info("Program started.\n");

  loggerInstance.info("> Connecting to database...");
  const readModel = ReadModelRepository.init(config);

  const readModelsQueriesClient = new ReadModelQueriesClient(readModel);
  loggerInstance.info("> Connected to database!\n");

  loggerInstance.info("> Getting data...");

  const purposes = await readModelsQueriesClient.getSENDPurposes(
    config.pnEserviceId,
    config.comuniELoroConsorziEAssociazioniAttributeId
  );

  if (purposes.length === 0) {
    loggerInstance.info("> No purposes data found.");
    return;
  }

  const csv = toCSV(purposes.map((p) => toCsvDataRow(p, loggerInstance)));

  loggerInstance.info("> Data csv produced!\n");

  loggerInstance.info("> Sending emails...");

  const mailer = initSesMailManager(config);

  await mailer.sendWithAttachments(
    {
      name: config.reportSenderLabel,
      address: config.reportSenderMail,
    },
    config.mailRecipients,
    MAIL_SUBJECT,
    MAIL_BODY,
    [{ filename: CSV_FILENAME, content: csv }]
  );

  loggerInstance.info("> Success!\n");
}

await withExecutionTime(main, loggerInstance);

process.exit(0);
// process.exit() should not be required.
// however, something in this script hangs on exit.
// TODO figure out why and remove this workaround.
