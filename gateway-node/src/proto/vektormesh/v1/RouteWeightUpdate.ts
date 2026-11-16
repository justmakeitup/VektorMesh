// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto


export interface RouteWeightUpdate {
  'sourceServiceId'?: (string);
  'targetServiceId'?: (string);
  'primaryWeightPct'?: (number | string);
  'canaryWeightPct'?: (number | string);
  'coldReplicaWeightPct'?: (number | string);
  'throttleNonCritical'?: (boolean);
  'reason'?: (string);
}

export interface RouteWeightUpdate__Output {
  'sourceServiceId': (string);
  'targetServiceId': (string);
  'primaryWeightPct': (number);
  'canaryWeightPct': (number);
  'coldReplicaWeightPct': (number);
  'throttleNonCritical': (boolean);
  'reason': (string);
}
