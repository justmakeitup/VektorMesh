// Original file: C:/Users/hp/Documents/VektorMesh/proto/vektormesh.proto

export const CircuitState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
} as const;

export type CircuitState =
  | 'CLOSED'
  | 0
  | 'OPEN'
  | 1
  | 'HALF_OPEN'
  | 2

export type CircuitState__Output = typeof CircuitState[keyof typeof CircuitState]
