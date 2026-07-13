BEGIN;

-- A cancelled row must have both a valid reason and a non-blank actor UUID.
DO $$
BEGIN
  BEGIN
    INSERT INTO "school_year_enrollment" (
      id,
      student_id,
      school_year_id,
      enrollment_date,
      cancelled_at,
      cancelled_by_user_id
    ) VALUES (
      '10000000-0000-4000-a000-000000000001',
      '20000000-0000-4000-a000-000000000001',
      '30000000-0000-4000-a000-000000000001',
      DATE '2030-09-01',
      CURRENT_TIMESTAMP,
      '40000000-0000-4000-a000-000000000001'
    );
    RAISE EXCEPTION 'Expected missing cancellation reason to be rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "school_year_enrollment" (
      id,
      student_id,
      school_year_id,
      enrollment_date,
      cancelled_at,
      cancellation_reason,
      cancelled_by_user_id
    ) VALUES (
      '10000000-0000-4000-a000-000000000002',
      '20000000-0000-4000-a000-000000000001',
      '30000000-0000-4000-a000-000000000001',
      DATE '2030-09-01',
      CURRENT_TIMESTAMP,
      'INVALID_REASON',
      '40000000-0000-4000-a000-000000000001'
    );
    RAISE EXCEPTION 'Expected invalid cancellation reason to be rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "school_year_enrollment" (
      id,
      student_id,
      school_year_id,
      enrollment_date,
      cancelled_at,
      cancellation_reason,
      cancellation_note,
      cancelled_by_user_id
    ) VALUES (
      '10000000-0000-4000-a000-000000000003',
      '20000000-0000-4000-a000-000000000001',
      '30000000-0000-4000-a000-000000000001',
      DATE '2030-09-01',
      CURRENT_TIMESTAMP,
      'OTHER',
      repeat('x', 501),
      '40000000-0000-4000-a000-000000000001'
    );
    RAISE EXCEPTION 'Expected oversized cancellation note to be rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

-- Adjacent inclusive periods do not overlap: Jan 31 remains active through
-- Jan 31, and a Feb 1 placement begins on the following date.
INSERT INTO "enrollment" (
  id,
  class_id,
  student_id,
  school_year_enrollment_id,
  enrollment_date,
  end_date,
  exit_reason
) VALUES (
  '50000000-0000-4000-a000-000000000001',
  '60000000-0000-4000-a000-000000000001',
  '20000000-0000-4000-a000-000000000001',
  '10000000-0000-4000-a000-000000000010',
  DATE '2030-01-01',
  DATE '2030-01-31',
  'TRANSFERRED'
), (
  '50000000-0000-4000-a000-000000000002',
  '60000000-0000-4000-a000-000000000002',
  '20000000-0000-4000-a000-000000000001',
  '10000000-0000-4000-a000-000000000010',
  DATE '2030-02-01',
  NULL,
  NULL
);

DO $$
BEGIN
  BEGIN
    INSERT INTO "enrollment" (
      id,
      class_id,
      student_id,
      school_year_enrollment_id,
      enrollment_date
    ) VALUES (
      '50000000-0000-4000-a000-000000000003',
      '60000000-0000-4000-a000-000000000003',
      '20000000-0000-4000-a000-000000000001',
      '10000000-0000-4000-a000-000000000010',
      DATE '2030-01-31'
    );
    RAISE EXCEPTION 'Expected inclusive overlap to be rejected';
  EXCEPTION WHEN exclusion_violation THEN
    NULL;
  END;
END $$;

-- Cancelled intervals do not participate in uniqueness or overlap checks, so
-- an exact replacement can be inserted.
INSERT INTO "enrollment" (
  id,
  class_id,
  student_id,
  school_year_enrollment_id,
  enrollment_date,
  cancelled_at,
  cancellation_reason,
  cancelled_by_user_id
) VALUES (
  '50000000-0000-4000-a000-000000000004',
  '60000000-0000-4000-a000-000000000004',
  '20000000-0000-4000-a000-000000000002',
  '10000000-0000-4000-a000-000000000020',
  DATE '2030-09-01',
  CURRENT_TIMESTAMP,
  'DATA_ENTRY_ERROR',
  '40000000-0000-4000-a000-000000000001'
);

INSERT INTO "enrollment" (
  id,
  class_id,
  student_id,
  school_year_enrollment_id,
  enrollment_date
) VALUES (
  '50000000-0000-4000-a000-000000000005',
  '60000000-0000-4000-a000-000000000004',
  '20000000-0000-4000-a000-000000000002',
  '10000000-0000-4000-a000-000000000020',
  DATE '2030-09-01'
);

-- Cancelling an open parent releases the partial uniqueness rule.
INSERT INTO "school_year_enrollment" (
  id,
  student_id,
  school_year_id,
  enrollment_date,
  cancelled_at,
  cancellation_reason,
  cancelled_by_user_id
) VALUES (
  '10000000-0000-4000-a000-000000000021',
  '20000000-0000-4000-a000-000000000002',
  '30000000-0000-4000-a000-000000000002',
  DATE '2030-09-01',
  CURRENT_TIMESTAMP,
  'DATA_ENTRY_ERROR',
  '40000000-0000-4000-a000-000000000001'
);

INSERT INTO "school_year_enrollment" (
  id,
  student_id,
  school_year_id,
  enrollment_date
) VALUES (
  '10000000-0000-4000-a000-000000000022',
  '20000000-0000-4000-a000-000000000002',
  '30000000-0000-4000-a000-000000000002',
  DATE '2030-09-01'
);

ROLLBACK;
