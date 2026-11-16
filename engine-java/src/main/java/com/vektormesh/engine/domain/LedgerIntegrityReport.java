package com.vektormesh.engine.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Audit Ledger Cryptographic Verification Report.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LedgerIntegrityReport {
    private boolean valid;
    private long totalRecords;
    private String lastVerifiedHash;
    private Long tamperedSequenceId;
    private String message;
}
