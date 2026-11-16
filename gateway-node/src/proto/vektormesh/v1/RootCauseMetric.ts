// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

export const RootCauseMetric = {
  NONE: 'NONE',
  CPU_JITTER: 'CPU_JITTER',
  HEAP_LEAK: 'HEAP_LEAK',
  DB_POOL_EXHAUSTION: 'DB_POOL_EXHAUSTION',
  NETWORK_THROTTLE: 'NETWORK_THROTTLE',
} as const;

export type RootCauseMetric =
  | 'NONE'
  | 0
  | 'CPU_JITTER'
  | 1
  | 'HEAP_LEAK'
  | 2
  | 'DB_POOL_EXHAUSTION'
  | 3
  | 'NETWORK_THROTTLE'
  | 4

export type RootCauseMetric__Output = typeof RootCauseMetric[keyof typeof RootCauseMetric]
