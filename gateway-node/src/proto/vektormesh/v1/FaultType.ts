// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

export const FaultType = {
  FAULT_TYPE_UNSPECIFIED: 'FAULT_TYPE_UNSPECIFIED',
  LATENCY_SPIKE: 'LATENCY_SPIKE',
  SOCKET_EXHAUSTION: 'SOCKET_EXHAUSTION',
  MEMORY_BLEED: 'MEMORY_BLEED',
  CORRUPT_PAYLOAD: 'CORRUPT_PAYLOAD',
} as const;

export type FaultType =
  | 'FAULT_TYPE_UNSPECIFIED'
  | 0
  | 'LATENCY_SPIKE'
  | 1
  | 'SOCKET_EXHAUSTION'
  | 2
  | 'MEMORY_BLEED'
  | 3
  | 'CORRUPT_PAYLOAD'
  | 4

export type FaultType__Output = typeof FaultType[keyof typeof FaultType]
