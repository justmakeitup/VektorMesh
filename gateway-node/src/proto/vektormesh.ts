import type * as grpc from '@grpc/grpc-js';
import type { EnumTypeDefinition, MessageTypeDefinition } from '@grpc/proto-loader';

import type { AnomalyInferenceServiceClient as _vektormesh_v1_AnomalyInferenceServiceClient, AnomalyInferenceServiceDefinition as _vektormesh_v1_AnomalyInferenceServiceDefinition } from './vektormesh/v1/AnomalyInferenceService';
import type { MeshControlServiceClient as _vektormesh_v1_MeshControlServiceClient, MeshControlServiceDefinition as _vektormesh_v1_MeshControlServiceDefinition } from './vektormesh/v1/MeshControlService';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  google: {
    protobuf: {
      Empty: MessageTypeDefinition
    }
  }
  vektormesh: {
    v1: {
      ActiveFault: MessageTypeDefinition
      AnomalyInferenceService: SubtypeConstructor<typeof grpc.Client, _vektormesh_v1_AnomalyInferenceServiceClient> & { service: _vektormesh_v1_AnomalyInferenceServiceDefinition }
      AnomalyVerdict: MessageTypeDefinition
      CircuitState: EnumTypeDefinition
      FaultInjectionRequest: MessageTypeDefinition
      FaultType: EnumTypeDefinition
      MeshControlService: SubtypeConstructor<typeof grpc.Client, _vektormesh_v1_MeshControlServiceClient> & { service: _vektormesh_v1_MeshControlServiceDefinition }
      RecommendedAction: EnumTypeDefinition
      RemediationAck: MessageTypeDefinition
      RootCauseMetric: EnumTypeDefinition
      RouteWeightUpdate: MessageTypeDefinition
      RouteWeights: MessageTypeDefinition
      ServiceNodeStatus: MessageTypeDefinition
      SystemStateSnapshot: MessageTypeDefinition
      TelemetryFrame: MessageTypeDefinition
    }
  }
}

