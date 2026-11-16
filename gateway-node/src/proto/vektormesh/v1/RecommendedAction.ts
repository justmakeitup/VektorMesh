// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

export const RecommendedAction = {
  NO_OP: 'NO_OP',
  THROTTLE_TRAFFIC: 'THROTTLE_TRAFFIC',
  OPEN_CIRCUIT: 'OPEN_CIRCUIT',
  REROUTE_COLD_REPLICA: 'REROUTE_COLD_REPLICA',
  RESTART_CONTAINER: 'RESTART_CONTAINER',
} as const;

export type RecommendedAction =
  | 'NO_OP'
  | 0
  | 'THROTTLE_TRAFFIC'
  | 1
  | 'OPEN_CIRCUIT'
  | 2
  | 'REROUTE_COLD_REPLICA'
  | 3
  | 'RESTART_CONTAINER'
  | 4

export type RecommendedAction__Output = typeof RecommendedAction[keyof typeof RecommendedAction]
