-- Add new provision types for full agreement ingest
-- Run this in Supabase SQL Editor

-- New provision types
INSERT INTO provision_types (key, label) VALUES
  ('ANTI', 'Antitrust / Regulatory Efforts'),
  ('COND', 'Conditions to Closing'),
  ('TERMR', 'Termination Rights'),
  ('TERMF', 'Termination Fees')
ON CONFLICT (key) DO NOTHING;

-- Antitrust sub-provisions
INSERT INTO provision_categories (provision_type_id, label, sort_order) VALUES
  ((SELECT id FROM provision_types WHERE key = 'ANTI'), 'Efforts Standard', 1),
  ((SELECT id FROM provision_types WHERE key = 'ANTI'), 'Anti-Hell or High Water', 2),
  ((SELECT id FROM provision_types WHERE key = 'ANTI'), 'Hell or High Water', 3),
  ((SELECT id FROM provision_types WHERE key = 'ANTI'), 'Burdensome Condition', 4),
  ((SELECT id FROM provision_types WHERE key = 'ANTI'), 'Definition of Burdensome Condition', 5),
  ((SELECT id FROM provision_types WHERE key = 'ANTI'), 'Obligation to Litigate', 6),
  ((SELECT id FROM provision_types WHERE key = 'ANTI'), 'Obligation Not to Litigate', 7),
  ((SELECT id FROM provision_types WHERE key = 'ANTI'), 'Regulatory Approval Filing Deadline', 8),
  ((SELECT id FROM provision_types WHERE key = 'ANTI'), 'Cooperation Obligations', 9)
ON CONFLICT (provision_type_id, label, parent_id) DO NOTHING;

-- Conditions to Closing sub-provisions
INSERT INTO provision_categories (provision_type_id, label, sort_order) VALUES
  ((SELECT id FROM provision_types WHERE key = 'COND'), 'Regulatory Approval / HSR', 1),
  ((SELECT id FROM provision_types WHERE key = 'COND'), 'No Legal Impediment', 2),
  ((SELECT id FROM provision_types WHERE key = 'COND'), 'Accuracy of Target Representations', 3),
  ((SELECT id FROM provision_types WHERE key = 'COND'), 'Accuracy of Acquirer Representations', 4),
  ((SELECT id FROM provision_types WHERE key = 'COND'), 'Target Compliance with Covenants', 5),
  ((SELECT id FROM provision_types WHERE key = 'COND'), 'Acquirer Compliance with Covenants', 6),
  ((SELECT id FROM provision_types WHERE key = 'COND'), 'No MAE', 7),
  ((SELECT id FROM provision_types WHERE key = 'COND'), 'Third-Party Consents', 8),
  ((SELECT id FROM provision_types WHERE key = 'COND'), 'Stockholder Approval', 9)
ON CONFLICT (provision_type_id, label, parent_id) DO NOTHING;

-- Termination Rights sub-provisions
INSERT INTO provision_categories (provision_type_id, label, sort_order) VALUES
  ((SELECT id FROM provision_types WHERE key = 'TERMR'), 'Mutual Termination', 1),
  ((SELECT id FROM provision_types WHERE key = 'TERMR'), 'Outside Date', 2),
  ((SELECT id FROM provision_types WHERE key = 'TERMR'), 'Outside Date Extension', 3),
  ((SELECT id FROM provision_types WHERE key = 'TERMR'), 'Regulatory Failure', 4),
  ((SELECT id FROM provision_types WHERE key = 'TERMR'), 'Breach by Target', 5),
  ((SELECT id FROM provision_types WHERE key = 'TERMR'), 'Breach by Acquirer', 6),
  ((SELECT id FROM provision_types WHERE key = 'TERMR'), 'Superior Proposal', 7),
  ((SELECT id FROM provision_types WHERE key = 'TERMR'), 'Intervening Event', 8),
  ((SELECT id FROM provision_types WHERE key = 'TERMR'), 'Failure of Conditions', 9)
ON CONFLICT (provision_type_id, label, parent_id) DO NOTHING;

-- Termination Fees sub-provisions
INSERT INTO provision_categories (provision_type_id, label, sort_order) VALUES
  ((SELECT id FROM provision_types WHERE key = 'TERMF'), 'Target Termination Fee', 1),
  ((SELECT id FROM provision_types WHERE key = 'TERMF'), 'Reverse Termination Fee', 2),
  ((SELECT id FROM provision_types WHERE key = 'TERMF'), 'Regulatory Break-Up Fee', 3),
  ((SELECT id FROM provision_types WHERE key = 'TERMF'), 'Fee Amount', 4),
  ((SELECT id FROM provision_types WHERE key = 'TERMF'), 'Fee Triggers', 5),
  ((SELECT id FROM provision_types WHERE key = 'TERMF'), 'Expense Reimbursement', 6),
  ((SELECT id FROM provision_types WHERE key = 'TERMF'), 'Fee as Percentage of Deal Value', 7)
ON CONFLICT (provision_type_id, label, parent_id) DO NOTHING;
