-- A cancellation that crosses the UTC enrollment boundary before COMMIT must
-- roll back. Constraint triggers are deferred so clock_timestamp() is checked
-- at the transaction's final constraint phase rather than at transaction start.

CREATE OR REPLACE FUNCTION enforce_sye_upcoming_cancellation_at_commit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cancelled_at IS NOT NULL
     AND OLD.cancelled_at IS NULL
     AND NEW.enrollment_date <= (clock_timestamp() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION 'ENROLLMENT_ALREADY_EFFECTIVE'
      USING ERRCODE = '23514',
            CONSTRAINT = 'sye_cancel_requires_upcoming_at_commit';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER sye_cancel_requires_upcoming_at_commit
AFTER UPDATE ON school_year_enrollment
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_sye_upcoming_cancellation_at_commit();

CREATE OR REPLACE FUNCTION enforce_enrollment_upcoming_cancellation_at_commit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cancelled_at IS NOT NULL
     AND OLD.cancelled_at IS NULL
     AND NEW.enrollment_date <= (clock_timestamp() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION 'CANCELLATION_CHILD_STATE_CONFLICT'
      USING ERRCODE = '23514',
            CONSTRAINT = 'enrollment_cancel_requires_upcoming_at_commit';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER enrollment_cancel_requires_upcoming_at_commit
AFTER UPDATE ON enrollment
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_enrollment_upcoming_cancellation_at_commit();

-- Rollback:
-- DROP TRIGGER IF EXISTS enrollment_cancel_requires_upcoming_at_commit ON enrollment;
-- DROP FUNCTION IF EXISTS enforce_enrollment_upcoming_cancellation_at_commit();
-- DROP TRIGGER IF EXISTS sye_cancel_requires_upcoming_at_commit ON school_year_enrollment;
-- DROP FUNCTION IF EXISTS enforce_sye_upcoming_cancellation_at_commit();
