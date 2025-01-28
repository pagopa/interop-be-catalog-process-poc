import { genericLogger } from "pagopa-interop-commons";
import { config } from "./config/config.js";
import app from "./app.js";

app.listen(config.port, config.host, () => {
  genericLogger.info(`listening on ${config.host}:${config.port}`);
});
