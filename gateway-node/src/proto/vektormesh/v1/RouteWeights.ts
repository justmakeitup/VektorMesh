// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto


export interface RouteWeights {
  'primaryWeightPct'?: (number | string);
  'canaryWeightPct'?: (number | string);
  'coldReplicaWeightPct'?: (number | string);
}

export interface RouteWeights__Output {
  'primaryWeightPct': (number);
  'canaryWeightPct': (number);
  'coldReplicaWeightPct': (number);
}
