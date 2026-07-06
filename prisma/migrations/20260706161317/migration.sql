-- RenameForeignKey
ALTER TABLE "medication_administration_log" RENAME CONSTRAINT "med_admin_log_correction_of_log_id_fkey" TO "medication_administration_log_occurrence_id_correction_of__fkey";

-- RenameForeignKey
ALTER TABLE "medication_administration_log" RENAME CONSTRAINT "med_admin_log_occurrence_id_fkey" TO "medication_administration_log_occurrence_id_fkey";

-- RenameForeignKey
ALTER TABLE "medication_administration_log" RENAME CONSTRAINT "med_admin_log_recorded_by_user_id_fkey" TO "medication_administration_log_recorded_by_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "medication_administration_occurrence" RENAME CONSTRAINT "med_admin_occurrence_campus_id_fkey" TO "medication_administration_occurrence_campus_id_fkey";

-- RenameForeignKey
ALTER TABLE "medication_administration_occurrence" RENAME CONSTRAINT "med_admin_occurrence_latest_log_id_fkey" TO "medication_administration_occurrence_id_latest_log_id_fkey";

-- RenameForeignKey
ALTER TABLE "medication_administration_occurrence" RENAME CONSTRAINT "med_admin_occurrence_latest_recorded_by_user_id_fkey" TO "medication_administration_occurrence_latest_recorded_by_us_fkey";

-- RenameForeignKey
ALTER TABLE "medication_administration_occurrence" RENAME CONSTRAINT "med_admin_occurrence_medication_item_id_fkey" TO "medication_administration_occurrence_request_id_medication_fkey";

-- RenameForeignKey
ALTER TABLE "medication_administration_occurrence" RENAME CONSTRAINT "med_admin_occurrence_request_id_fkey" TO "medication_administration_occurrence_request_id_campus_id__fkey";

-- RenameForeignKey
ALTER TABLE "medication_administration_occurrence" RENAME CONSTRAINT "med_admin_occurrence_student_id_fkey" TO "medication_administration_occurrence_student_id_fkey";

-- RenameForeignKey
ALTER TABLE "medication_request_timeline_entry" RENAME CONSTRAINT "med_request_timeline_actor_guardian_id_fkey" TO "medication_request_timeline_entry_actor_guardian_id_fkey";

-- RenameForeignKey
ALTER TABLE "medication_request_timeline_entry" RENAME CONSTRAINT "med_request_timeline_actor_user_id_fkey" TO "medication_request_timeline_entry_actor_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "medication_request_timeline_entry" RENAME CONSTRAINT "med_request_timeline_campus_id_fkey" TO "medication_request_timeline_entry_campus_id_fkey";

-- RenameForeignKey
ALTER TABLE "medication_request_timeline_entry" RENAME CONSTRAINT "med_request_timeline_request_id_fkey" TO "medication_request_timeline_entry_request_id_campus_id_fkey";
