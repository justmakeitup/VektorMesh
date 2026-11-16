// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { AnomalyVerdict as _vektormesh_v1_AnomalyVerdict, AnomalyVerdict__Output as _vektormesh_v1_AnomalyVerdict__Output } from '../../vektormesh/v1/AnomalyVerdict';
import type { TelemetryFrame as _vektormesh_v1_TelemetryFrame, TelemetryFrame__Output as _vektormesh_v1_TelemetryFrame__Output } from '../../vektormesh/v1/TelemetryFrame';

export interface AnomalyInferenceServiceClient extends grpc.Client {
  EvaluateSingleFrame(argument: _vektormesh_v1_TelemetryFrame, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_AnomalyVerdict__Output>): grpc.ClientUnaryCall;
  EvaluateSingleFrame(argument: _vektormesh_v1_TelemetryFrame, metadata: grpc.Metadata, callback: grpc.requestCallback<_vektormesh_v1_AnomalyVerdict__Output>): grpc.ClientUnaryCall;
  EvaluateSingleFrame(argument: _vektormesh_v1_TelemetryFrame, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_AnomalyVerdict__Output>): grpc.ClientUnaryCall;
  EvaluateSingleFrame(argument: _vektormesh_v1_TelemetryFrame, callback: grpc.requestCallback<_vektormesh_v1_AnomalyVerdict__Output>): grpc.ClientUnaryCall;
  evaluateSingleFrame(argument: _vektormesh_v1_TelemetryFrame, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_AnomalyVerdict__Output>): grpc.ClientUnaryCall;
  evaluateSingleFrame(argument: _vektormesh_v1_TelemetryFrame, metadata: grpc.Metadata, callback: grpc.requestCallback<_vektormesh_v1_AnomalyVerdict__Output>): grpc.ClientUnaryCall;
  evaluateSingleFrame(argument: _vektormesh_v1_TelemetryFrame, options: grpc.CallOptions, callback: grpc.requestCallback<_vektormesh_v1_AnomalyVerdict__Output>): grpc.ClientUnaryCall;
  evaluateSingleFrame(argument: _vektormesh_v1_TelemetryFrame, callback: grpc.requestCallback<_vektormesh_v1_AnomalyVerdict__Output>): grpc.ClientUnaryCall;
  
  EvaluateTelemetryStream(metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientDuplexStream<_vektormesh_v1_TelemetryFrame, _vektormesh_v1_AnomalyVerdict__Output>;
  EvaluateTelemetryStream(options?: grpc.CallOptions): grpc.ClientDuplexStream<_vektormesh_v1_TelemetryFrame, _vektormesh_v1_AnomalyVerdict__Output>;
  evaluateTelemetryStream(metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientDuplexStream<_vektormesh_v1_TelemetryFrame, _vektormesh_v1_AnomalyVerdict__Output>;
  evaluateTelemetryStream(options?: grpc.CallOptions): grpc.ClientDuplexStream<_vektormesh_v1_TelemetryFrame, _vektormesh_v1_AnomalyVerdict__Output>;
  
}

export interface AnomalyInferenceServiceHandlers extends grpc.UntypedServiceImplementation {
  EvaluateSingleFrame: grpc.handleUnaryCall<_vektormesh_v1_TelemetryFrame__Output, _vektormesh_v1_AnomalyVerdict>;
  
  EvaluateTelemetryStream: grpc.handleBidiStreamingCall<_vektormesh_v1_TelemetryFrame__Output, _vektormesh_v1_AnomalyVerdict>;
  
}

export interface AnomalyInferenceServiceDefinition extends grpc.ServiceDefinition {
  EvaluateSingleFrame: MethodDefinition<_vektormesh_v1_TelemetryFrame, _vektormesh_v1_AnomalyVerdict, _vektormesh_v1_TelemetryFrame__Output, _vektormesh_v1_AnomalyVerdict__Output>
  EvaluateTelemetryStream: MethodDefinition<_vektormesh_v1_TelemetryFrame, _vektormesh_v1_AnomalyVerdict, _vektormesh_v1_TelemetryFrame__Output, _vektormesh_v1_AnomalyVerdict__Output>
}
