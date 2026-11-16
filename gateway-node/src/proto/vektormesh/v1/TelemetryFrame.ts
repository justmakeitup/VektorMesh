// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

import type { Long } from '@grpc/proto-loader';

export interface TelemetryFrame {
  'serviceId'?: (string);
  'timestampMs'?: (number | string | Long);
  'cpuJitterPct'?: (number | string);
  'threadPoolSaturationPct'?: (number | string);
  'heapUsedMb'?: (number | string);
  'heapMaxMb'?: (number | string);
  'p95LatencyMs'?: (number | string);
  'p99LatencyMs'?: (number | string);
  'errorRatePct'?: (number | string);
  'activeConnections'?: (number);
}

export interface TelemetryFrame__Output {
  'serviceId': (string);
  'timestampMs': (string);
  'cpuJitterPct': (number);
  'threadPoolSaturationPct': (number);
  'heapUsedMb': (number);
  'heapMaxMb': (number);
  'p95LatencyMs': (number);
  'p99LatencyMs': (number);
  'errorRatePct': (number);
  'activeConnections': (number);
}
