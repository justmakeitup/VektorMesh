// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

import type { FaultType as _vektormesh_v1_FaultType, FaultType__Output as _vektormesh_v1_FaultType__Output } from '../../vektormesh/v1/FaultType';

export interface FaultInjectionRequest {
  'targetServiceId'?: (string);
  'faultType'?: (_vektormesh_v1_FaultType);
  'intensityPct'?: (number);
  'durationSeconds'?: (number);
}

export interface FaultInjectionRequest__Output {
  'targetServiceId': (string);
  'faultType': (_vektormesh_v1_FaultType__Output);
  'intensityPct': (number);
  'durationSeconds': (number);
}
