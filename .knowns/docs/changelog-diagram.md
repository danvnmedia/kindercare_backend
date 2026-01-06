---
title: changelog diagram
createdAt: '2026-01-06T04:18:48.128Z'
updatedAt: '2026-01-06T04:19:20.528Z'
description: Architecture changes from Single School to Federated Multi-Campus schema
tags:
  - changelog
  - architecture
  - schema
  - database
---
# Schema Changelog: Single School to Federated Multi-Campus

This document details the changes comparing the **Original (Single School)** schema to the **New (Federated Multi-Campus)** schema.

---

## 1. Architecture: From Single Location to Federated Campus

**Change:** Introduced the `campus` table as the root entity.

**Impact:** The system can now manage multiple physical school locations (e.g., "North Campus", "South Campus") within a single database instance.

- **New Table:** `campus` (id, name, code, etc.)
- **Foreign Keys:** Added `campus_id` to almost every operational table to silo data by location.

---

## 2. Access Control: From Simple JSON to Scoped RBAC

**Change:** Moved from a simple JSON permissions model to a structured Role-Based Access Control (RBAC) system that is aware of campuses.

| Feature | Original Schema | New Schema |
| :--- | :--- | :--- |
| **Permissions** | Stored inside `role.permissions` (JSONB) | **New Table:** `permission` (Atomic rows like `student.create`) |
| **Role Definition** | Global (Text ID) | **Scoped:** `role` table now has `campus_id`. Roles can be specific to a campus. |
| **Role Assignment** | `user_roles` (User + Role) | `user_roles` (User + Role + **Campus**). You can be an Admin at Campus A and a Parent at Campus B. |
| **System Safety** | None | Added `is_system_default` boolean to protect core roles from deletion. |



---

## 3. Staff Management: From Strings to Configurable Types

**Change:** Replaced hardcoded text strings with a configurable lookup table scoped to the campus.

- **Old:** `staff.staff_type` was a `text` column (e.g., "Teacher").
- **New:**
  - **New Table:** `staff_type` (id, name, `campus_id`, `default_role_id`).
  - **Relationship:** `staff` table now references `staff_type_id`.
- **Benefit:** Campus A can have "Senior Professors" and Campus B can have "Instructors". The `default_role_id` allows auto-assigning security permissions based on job title.

---

## 4. Guardian Management: From Global to Campus-Specific

**Change:** Guardians are no longer global entities. A Guardian profile is now strictly tied to a specific campus.

- **Scoping:** Added `campus_id` to the `guardian` table.
- **Uniqueness:**
  - **Old:** `email` was globally unique.
  - **New:** `email` is unique **per campus** `(campus_id, email)`.
- **Implication:** If a parent has one child in Campus A and another in Campus B:
  - They still use **one** login (`user` table).
  - But they have **two** Guardian profile rows (one for each campus). This allows different contact details or emergency preferences per location.

---

## 5. Constraints & Indexes (Crucial Data Integrity)

**Change:** Global unique constraints were relaxed to be unique only within a campus context.

| Table | Original Unique Index | New Unique Index |
| :--- | :--- | :--- |
| `student` | `student_code` | `(campus_id, student_code)` |
| `student` | `email` | `(campus_id, email)` |
| `staff` | `email` | `(campus_id, email)` |
| `staff` | `user_id` | `(campus_id, user_id)` (One active profile per user per campus) |
| `guardian` | `email` | `(campus_id, email)` |
| `class` | `(year, grade, name)` | `(campus_id, year, grade, name)` |



---

## 6. Academic & Operational Scope

**Change:** All academic structures and content are now isolated per campus.

- **Academic Tables:** `grade_level`, `subject`, `school_year`, `class`, `enrollment` all gained `campus_id`.
  - *Reason:* Campuses might run on different dates or offer different curriculums.
- **Content:** `post`, `post_audience`, and `file` gained `campus_id`.
  - *Reason:* An announcement for "Sports Day" at Campus A should not be visible to Campus B.
- **Attendance:** `student_attendance` gained `campus_id` for performance indexing and data separation.

---

## 7. Sequences

**Change:** Student codes are generated per campus.

- **Old:** `student_code_sequence` PK was `year`.
- **New:** `student_code_sequence` PK is `(campus_id, year)`. Campus A can have student #001 and Campus B can also have student #001.

---

## 8. Guardian Table Cleanup

**Change:** `spouse_id` has been removed from the `guardian` table.
