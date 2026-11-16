package com.vektormesh.engine.chaos;

import ai.vektormesh.v1.FaultType;
import lombok.Builder;
import lombok.Getter;

/**
 * In-memory representation of an active chaos fault with TTL tracking.
 */
@Getter
@Builder
public class ActiveFaultState {
    private final String targetServiceId;
    private final FaultType faultType;
    private final int intensityPct;
    private final int durationSeconds;
    private final long startedAtMs;
    private final long expiresAtMs;

    public boolean isExpired() {
        return System.currentTimeMillis() >= expiresAtMs;
    }

    public int getRemainingSeconds() {
        long remainingMs = Math.max(0, expiresAtMs - System.currentTimeMillis());
        return (int) (remainingMs / 1000);
    }
}
