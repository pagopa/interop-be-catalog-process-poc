> NOTE: this repo is still a work in progress

# Interoperability Monorepo

## How to start

To get started, you will need:

- Node.js (https://nodejs.org/en/download/package-manager)
- pnpm (https://pnpm.io/installation)
- Docker (for local development, https://www.docker.com/get-started/)

Then install the dependencies with

```
pnpm install
```

## How to run a single service in watch mode

```
pnpm start:<service-name>
# example: pnpm start:catalog
```

## How to run the tests

```
pnpm test
```

## How to work locally with the read model

First, start the `consumer` service by running

```
pnpm start:consumer
```

This will start a local instance of Debezium (alongside with its requirements Zookeeper and Kafka) and a local MongoDB instance which will contain the read model.

Then, start a process service by running (for example):

```
pnpm start:catalog
```

This will start a local Postgres instance for storing the events and the service itself.

You can test everything is working by posting an event to the service, for example:

```bash
curl -X POST http://localhost:3000/eservices \
  -d '{ "name": "Example name", "description": "Example description", "technology": "REST", "attributes": { "certified": [], "declared": [], "verified": [] } }' \
  -H "Content-Type: application/json" \
  -H 'X-Correlation-Id: test' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcmdhbml6YXRpb25JZCI6IjRENTU2OTZGLTE2QzAtNDk2OC04NTRCLTJCMTY2Mzk3RkMzMCIsInVzZXItcm9sZXMiOiJBZG1pbiJ9.zeHj5I2QnhfVenY36NwuElyQDo1NKc22Z3rJXSkli2s"
```

You should see the event being processed by the consumer and the read model being updated.
You can verify this by using Mongo Express, which is being started alongside the consumer and is available at http://localhost:8081/db/readmodel.
