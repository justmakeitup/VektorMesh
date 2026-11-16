// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

import type { CircuitState as _vektormesh_v1_CircuitState, CircuitState__Output as _vektormesh_v1_CircuitState__Output } from '../../vektormesh/v1/CircuitState';
import type { RouteWeights as _vektormesh_v1_RouteWeights, RouteWeights__Output as _vektormesh_v1_RouteWeights__Output } from '../../vektormesh/v1/RouteWeights';
import type { ActiveFault as _vektormesh_v1_ActiveFault, ActiveFault__Output as _vektormesh_v1_ActiveFault__Output } from '../../vektormesh/v1/ActiveFault';
import type { TelemetryFrame as _vektormesh_v1_TelemetryFrame, TelemetryFrame__Output as _vektormesh_v1_TelemetryFrame__Output } from '../../vektormesh/v1/TelemetryFrame';
import type { AnomalyVerdict as _vektormesh_v1_AnomalyVerdict, AnomalyVerdict__Output as _vektormesh_v1_AnomalyVerdict__Output } from '../../vektormesh/v1/AnomalyVerdict';

export interface ServiceNodeStatus {
  'serviceId'?: (string);
  'circuitState'?: (_vektormesh_v1_CircuitState);
  'currentRouteWeights'?: (_vektormesh_v1_RouteWeights | null);
  'activeFaults'?: (_vektormesh_v1_ActiveFault)[];
  'latestTelemetry'?: (_vektormesh_v1_TelemetryFrame | null);
  'latestVerdict'?: (_vektormesh_v1_AnomalyVerdict | null);
}

export interface ServiceNodeStatus__Output {
  'serviceId': (string);
  'circuitState': (_vektormesh_v1_CircuitState__Output);
  'currentRouteWeights': (_vektormesh_v1_RouteWeights__Output | null);
  'activeFaults': (_vektormesh_v1_ActiveFault__Output)[];
  'latestTelemetry': (_vektormesh_v1_TelemetryFrame__Output | null);
  'latestVerdict': (_vektormesh_v1_AnomalyVerdict__Output | null);
}
