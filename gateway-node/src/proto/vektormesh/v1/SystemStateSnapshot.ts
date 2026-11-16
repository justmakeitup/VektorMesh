// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

import type { ServiceNodeStatus as _vektormesh_v1_ServiceNodeStatus, ServiceNodeStatus__Output as _vektormesh_v1_ServiceNodeStatus__Output } from '../../vektormesh/v1/ServiceNodeStatus';
import type { RouteWeightUpdate as _vektormesh_v1_RouteWeightUpdate, RouteWeightUpdate__Output as _vektormesh_v1_RouteWeightUpdate__Output } from '../../vektormesh/v1/RouteWeightUpdate';
import type { Long } from '@grpc/proto-loader';

export interface SystemStateSnapshot {
  'snapshotTimestampMs'?: (number | string | Long);
  'nodes'?: (_vektormesh_v1_ServiceNodeStatus)[];
  'activeRoutes'?: (_vektormesh_v1_RouteWeightUpdate)[];
}

export interface SystemStateSnapshot__Output {
  'snapshotTimestampMs': (string);
  'nodes': (_vektormesh_v1_ServiceNodeStatus__Output)[];
  'activeRoutes': (_vektormesh_v1_RouteWeightUpdate__Output)[];
}
