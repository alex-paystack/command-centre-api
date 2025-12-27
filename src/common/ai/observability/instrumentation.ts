import { NodeSDK } from '@opentelemetry/sdk-node';
import { getSpanProcessors } from './langfuse.config';

const sdk = new NodeSDK({
  spanProcessors: getSpanProcessors(),
});

sdk.start();
