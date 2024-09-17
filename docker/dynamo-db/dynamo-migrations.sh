#!/bin/bash

IFS=',' read -ra TABLES <<< "$TABLES"
for TABLE_NAME in "${TABLES[@]}"; do
  echo "Checking if table $TABLE_NAME exists..."
  TABLE_EXISTS=$(aws dynamodb list-tables --endpoint-url http://dynamodb-local:8000 | grep -w ${TABLE_NAME})
  if [ -z "$TABLE_EXISTS" ]; then
    echo "Table $TABLE_NAME does not exist. Creating table..."
    aws dynamodb create-table --cli-input-json file://./schema/$TABLE_NAME-dynamo-db.json --billing-mode PAY_PER_REQUEST --endpoint-url http://dynamodb-local:8000
    aws dynamodb batch-write-item --request-items file://./seed/$TABLE_NAME-seed.json --endpoint-url http://dynamodb-local:8000
  fi
done