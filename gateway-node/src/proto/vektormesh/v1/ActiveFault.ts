// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

import type { FaultType as _vektormesh_v1_FaultType, FaultType__Output as _vektormesh_v1_FaultType__Output } from '../../vektormesh/v1/FaultType';
import type { Long } from '@grpc/proto-loader';

export interface ActiveFault {
  'faultType'?: (_vektormesh_v1_FaultType);
  'intensityPct'?: (number);
  'startedAtMs'?: (number | string | Long);
  'durationSeconds'?: (number);
  'remainingSeconds'?: (number);
}

export interface ActiveFault__Output {
  'faultType': (_vektormesh_v1_FaultType__Output);
  'intensityPct': (number);
  'startedAtMs': (string);
  'durationSeconds': (number);
  'remainingSeconds': (number);
}
