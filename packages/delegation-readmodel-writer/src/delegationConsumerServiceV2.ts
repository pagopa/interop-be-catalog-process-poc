import { DelegationCollection } from "pagopa-interop-commons";
import {
  DelegationEventEnvelopeV2,
  fromDelegationV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: DelegationEventEnvelopeV2,
  delegations: DelegationCollection
): Promise<void> {
  await match(message)
    .with(
      { type: "ProducerDelegationApproved" },
      { type: "ProducerDelegationRejected" },
      { type: "ProducerDelegationRevoked" },
      { type: "ProducerDelegationSubmitted" },
      { type: "ConsumerDelegationSubmitted" },
      { type: "ConsumerDelegationApproved" },
      { type: "ConsumerDelegationRejected" },
      { type: "ConsumerDelegationRevoked" },
      async (message) => {
        const delegation = message.data.delegation;
        await delegations.updateOne(
          {
            "data.id": message.stream_id,
            "metadata.version": { $lte: message.version },
          },
          {
            $set: {
              data: delegation ? fromDelegationV2(delegation) : undefined,
              metadata: {
                version: message.version,
              },
            },
          },
          { upsert: true }
        );
      }
    )
    .exhaustive();
}
