// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

import type { Long } from '@grpc/proto-loader';

export interface RemediationAck {
  'success'?: (boolean);
  'remediationId'?: (string);
  'message'?: (string);
  'appliedAtMs'?: (number | string | Long);
}

export interface RemediationAck__Output {
  'success': (boolean);
  'remediationId': (string);
  'message': (string);
  'appliedAtMs': (string);
}
