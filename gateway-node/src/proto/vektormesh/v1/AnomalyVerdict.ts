// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

import type { RootCauseMetric as _vektormesh_v1_RootCauseMetric, RootCauseMetric__Output as _vektormesh_v1_RootCauseMetric__Output } from '../../vektormesh/v1/RootCauseMetric';
import type { RecommendedAction as _vektormesh_v1_RecommendedAction, RecommendedAction__Output as _vektormesh_v1_RecommendedAction__Output } from '../../vektormesh/v1/RecommendedAction';
import type { Long } from '@grpc/proto-loader';

export interface AnomalyVerdict {
  'serviceId'?: (string);
  'timestampMs'?: (number | string | Long);
  'cascadeProbability'?: (number | string);
  'ewmaZScore'?: (number | string);
  'isolationForestScore'?: (number | string);
  'rootCauseMetric'?: (_vektormesh_v1_RootCauseMetric);
  'recommendedAction'?: (_vektormesh_v1_RecommendedAction);
}

export interface AnomalyVerdict__Output {
  'serviceId': (string);
  'timestampMs': (string);
  'cascadeProbability': (number);
  'ewmaZScore': (number);
  'isolationForestScore': (number);
  'rootCauseMetric': (_vektormesh_v1_RootCauseMetric__Output);
  'recommendedAction': (_vektormesh_v1_RecommendedAction__Output);
}
