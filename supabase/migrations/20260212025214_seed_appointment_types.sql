/*
  # Seed Default Appointment Types

  1. New Data
    - Inserts 9 appointment types into `appointment_types` table (alphabetical order):
      - Milestone Delivery (30 min)
      - Milestone Review (45 min)
      - New Discovery (60 min)
      - Post Delivery Check-In (30 min)
      - Product Delivery (45 min)
      - Proposal Delivery (45 min)
      - QA Product (30 min)
      - SOW Review (45 min)
      - Stakeholder Meeting (60 min)
    - All linked to existing calendar and organization
    - All use Google Meet as the default location type

  2. Safety
    - Uses NOT EXISTS guard to prevent duplicate inserts
*/

INSERT INTO appointment_types (
  id, org_id, calendar_id, name, slug, description,
  duration_minutes, location_type, location_value, questions,
  slot_interval_minutes, buffer_before_minutes, buffer_after_minutes,
  min_notice_minutes, booking_window_days, max_per_day,
  generate_google_meet, active, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  c.org_id,
  c.id,
  v.name,
  v.slug,
  v.description,
  v.duration_minutes,
  v.location_type::text,
  NULL,
  '[]'::jsonb,
  15,
  5,
  5,
  v.min_notice_minutes,
  30,
  NULL,
  true,
  true,
  now(),
  now()
FROM calendars c
CROSS JOIN (
  VALUES
    ('Milestone Delivery',     'milestone-delivery',     'Final delivery of a completed project milestone',     30, 'google_meet', 60),
    ('Milestone Review',       'milestone-review',       'Review session for an in-progress project milestone', 45, 'google_meet', 60),
    ('New Discovery',          'new-discovery',          'Initial discovery call with a prospective client',    60, 'google_meet', 120),
    ('Post Delivery Check-In', 'post-delivery-check-in', 'Follow-up check-in after project delivery',          30, 'google_meet', 60),
    ('Product Delivery',       'product-delivery',       'Final product delivery and handoff meeting',          45, 'google_meet', 60),
    ('Proposal Delivery',      'proposal-delivery',      'Presentation and walkthrough of a project proposal', 45, 'google_meet', 120),
    ('QA Product',             'qa-product',             'Quality assurance review of a product build',         30, 'google_meet', 60),
    ('SOW Review',             'sow-review',             'Review and discussion of the Statement of Work',     45, 'google_meet', 120),
    ('Stakeholder Meeting',    'stakeholder-meeting',    'Meeting with key project stakeholders',               60, 'google_meet', 60)
) AS v(name, slug, description, duration_minutes, location_type, min_notice_minutes)
WHERE c.id = 'fa3d2e30-a9cd-498c-99fb-3a7aa4f6dba7'
  AND NOT EXISTS (
    SELECT 1 FROM appointment_types at2
    WHERE at2.calendar_id = c.id AND at2.name = v.name
  );
