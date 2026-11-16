// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { AnomalyVerdict as _vektormesh_v1_AnomalyVerdict, AnomalyVerdict__Output as _vektormesh_v1_AnomalyVerdict__Output } from '../../vektormesh/v1/AnomalyVerdict';
import type { Empty as _google_protobuf_Empty, Empty__Output as _google_protobuf_Empty__Output } from '../../google/protobuf/Empty';
import type { FaultInjectionRequest as _vektormesh_v1_FaultInjectionRequest, FaultInjectionRequest__Output as _vektormesh_v1_FaultInjectionRequest__Output } from '../../vektormesh/v1/FaultInjectionRequest';
import type { RemediationAck as _vektormesh_v1_RemediationAck, RemediationAck__Output as _vektormesh_v1_RemediationAck__Output } from '../../vektormesh/v1/RemediationAck';
import type { RouteWeightUpdate as _vektormesh_v1_RouteWeightUpdate, RouteWeightUpdate__Output as _vektormesh_v1_RouteWeightUpdate__Output } from '../../vektormesh/v1/RouteWeightUpdate';
import type { SystemStateSnapshot as _vektormesh_v1_SystemStateSnapshot, SystemStateSnapshot__Output as _vektormesh_v1_SystemStateSnapshot__Output } from '../../vektormesh/v1/SystemStateSnapshot';

export interface MeshControlServiceClient extends grpc.Client {
  ApplyRemediation(argument: _vektormesh_v1_AnomalyVerdict, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  ApplyRemediation(argument: _vektormesh_v1_AnomalyVerdict, metadata: grpc.Metadata, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  ApplyRemediation(argument: _vektormesh_v1_AnomalyVerdict, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  ApplyRemediation(argument: _vektormesh_v1_AnomalyVerdict, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  applyRemediation(argument: _vektormesh_v1_AnomalyVerdict, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  applyRemediation(argument: _vektormesh_v1_AnomalyVerdict, metadata: grpc.Metadata, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  applyRemediation(argument: _vektormesh_v1_AnomalyVerdict, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  applyRemediation(argument: _vektormesh_v1_AnomalyVerdict, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  
  OverrideRouteWeights(argument: _vektormesh_v1_RouteWeightUpdate, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  OverrideRouteWeights(argument: _vektormesh_v1_RouteWeightUpdate, metadata: grpc.Metadata, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  OverrideRouteWeights(argument: _vektormesh_v1_RouteWeightUpdate, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  OverrideRouteWeights(argument: _vektormesh_v1_RouteWeightUpdate, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  overrideRouteWeights(argument: _vektormesh_v1_RouteWeightUpdate, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  overrideRouteWeights(argument: _vektormesh_v1_RouteWeightUpdate, metadata: grpc.Metadata, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  overrideRouteWeights(argument: _vektormesh_v1_RouteWeightUpdate, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  overrideRouteWeights(argument: _vektormesh_v1_RouteWeightUpdate, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  
  StreamSystemState(argument: _google_protobuf_Empty, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_vektormesh_v1_SystemStateSnapshot__Output>;
  StreamSystemState(argument: _google_protobuf_Empty, options?: grpc.CallOptions): grpc.ClientReadableStream<_vektormesh_v1_SystemStateSnapshot__Output>;
  streamSystemState(argument: _google_protobuf_Empty, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_vektormesh_v1_SystemStateSnapshot__Output>;
  streamSystemState(argument: _google_protobuf_Empty, options?: grpc.CallOptions): grpc.ClientReadableStream<_vektormesh_v1_SystemStateSnapshot__Output>;
  
  TriggerChaosFault(argument: _vektormesh_v1_FaultInjectionRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  TriggerChaosFault(argument: _vektormesh_v1_FaultInjectionRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  TriggerChaosFault(argument: _vektormesh_v1_FaultInjectionRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  TriggerChaosFault(argument: _vektormesh_v1_FaultInjectionRequest, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  triggerChaosFault(argument: _vektormesh_v1_FaultInjectionRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  triggerChaosFault(argument: _vektormesh_v1_FaultInjectionRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  triggerChaosFault(argument: _vektormesh_v1_FaultInjectionRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  triggerChaosFault(argument: _vektormesh_v1_FaultInjectionRequest, callback: grpc.requestCallback<_vektormesh_v1_RemediationAck__Output>): grpc.ClientUnaryCall;
  
}

export interface MeshControlServiceHandlers extends grpc.UntypedServiceImplementation {
  ApplyRemediation: grpc.handleUnaryCall<_vektormesh_v1_AnomalyVerdict__Output, _vektormesh_v1_RemediationAck>;
  
  OverrideRouteWeights: grpc.handleUnaryCall<_vektormesh_v1_RouteWeightUpdate__Output, _vektormesh_v1_RemediationAck>;
  
  StreamSystemState: grpc.handleServerStreamingCall<_google_protobuf_Empty__Output, _vektormesh_v1_SystemStateSnapshot>;
  
  TriggerChaosFault: grpc.handleUnaryCall<_vektormesh_v1_FaultInjectionRequest__Output, _vektormesh_v1_RemediationAck>;
  
}

export interface MeshControlServiceDefinition extends grpc.ServiceDefinition {
  ApplyRemediation: MethodDefinition<_vektormesh_v1_AnomalyVerdict, _vektormesh_v1_RemediationAck, _vektormesh_v1_AnomalyVerdict__Output, _vektormesh_v1_RemediationAck__Output>
  OverrideRouteWeights: MethodDefinition<_vektormesh_v1_RouteWeightUpdate, _vektormesh_v1_RemediationAck, _vektormesh_v1_RouteWeightUpdate__Output, _vektormesh_v1_RemediationAck__Output>
  StreamSystemState: MethodDefinition<_google_protobuf_Empty, _vektormesh_v1_SystemStateSnapshot, _google_protobuf_Empty__Output, _vektormesh_v1_SystemStateSnapshot__Output>
  TriggerChaosFault: MethodDefinition<_vektormesh_v1_FaultInjectionRequest, _vektormesh_v1_RemediationAck, _vektormesh_v1_FaultInjectionRequest__Output, _vektormesh_v1_RemediationAck__Output>
}
