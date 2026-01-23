/*
  # Seed Media Sample Data

  1. Sample Data Created
    - drive_connection: Mock connection (inactive for demo)
    - drive_folders: Sample folder structure (Documents, Images, Projects)
    - drive_files: Sample files with various types and states
    - file_attachments: Sample attachments linking files to contacts

  2. Notes
    - Connection is inactive since no real OAuth tokens
    - Includes files with access_revoked state for testing unavailable UI
    - Includes various file types (docs, images, spreadsheets, PDFs)
*/

DO $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_user_id uuid;
  v_contact_id_1 uuid;
  v_contact_id_2 uuid;
  v_file_id_1 uuid;
  v_file_id_2 uuid;
  v_file_id_3 uuid;
  v_file_id_4 uuid;
BEGIN
  -- Get user and contact IDs
  SELECT id INTO v_user_id FROM users WHERE organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_contact_id_1 FROM contacts WHERE organization_id = v_org_id LIMIT 1;
  SELECT id INTO v_contact_id_2 FROM contacts WHERE organization_id = v_org_id OFFSET 1 LIMIT 1;

  -- Skip if no user found
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Insert sample drive connection (inactive - no real tokens)
  INSERT INTO drive_connections (
    organization_id, email, access_token_encrypted, refresh_token_encrypted,
    token_expiry, scopes, is_active
  ) VALUES (
    v_org_id,
    'demo@example.com',
    'encrypted_placeholder_access_token',
    'encrypted_placeholder_refresh_token',
    now() - interval '1 hour',
    ARRAY['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.metadata.readonly'],
    false
  ) ON CONFLICT (organization_id) DO NOTHING;

  -- Insert sample folders
  INSERT INTO drive_folders (organization_id, drive_folder_id, name, parent_drive_folder_id, path)
  VALUES
    (v_org_id, 'root', 'My Drive', NULL, '/'),
    (v_org_id, 'folder_documents', 'Documents', 'root', '/Documents'),
    (v_org_id, 'folder_images', 'Images', 'root', '/Images'),
    (v_org_id, 'folder_projects', 'Projects', 'root', '/Projects'),
    (v_org_id, 'folder_contracts', 'Contracts', 'folder_documents', '/Documents/Contracts'),
    (v_org_id, 'folder_proposals', 'Proposals', 'folder_documents', '/Documents/Proposals')
  ON CONFLICT (organization_id, drive_folder_id) DO NOTHING;

  -- Insert sample files
  INSERT INTO drive_files (
    organization_id, drive_file_id, name, mime_type, size_bytes,
    drive_owner_email, parent_drive_folder_id, web_view_link, is_deleted, access_revoked
  ) VALUES
    (v_org_id, 'file_contract_001', 'Service Agreement.pdf', 'application/pdf', 245760,
     'demo@example.com', 'folder_contracts', 'https://drive.google.com/file/d/file_contract_001/view', false, false),
    (v_org_id, 'file_proposal_001', 'Project Proposal Q1.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 102400,
     'demo@example.com', 'folder_proposals', 'https://drive.google.com/file/d/file_proposal_001/view', false, false),
    (v_org_id, 'file_budget_001', 'Budget 2024.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 51200,
     'demo@example.com', 'folder_documents', 'https://drive.google.com/file/d/file_budget_001/view', false, false),
    (v_org_id, 'file_photo_001', 'Team Photo.jpg', 'image/jpeg', 2097152,
     'demo@example.com', 'folder_images', 'https://drive.google.com/file/d/file_photo_001/view', false, false),
    (v_org_id, 'file_logo_001', 'Company Logo.png', 'image/png', 524288,
     'demo@example.com', 'folder_images', 'https://drive.google.com/file/d/file_logo_001/view', false, false),
    (v_org_id, 'file_presentation_001', 'Sales Deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 5242880,
     'demo@example.com', 'folder_projects', 'https://drive.google.com/file/d/file_presentation_001/view', false, false),
    (v_org_id, 'file_old_contract', 'Old Contract.pdf', 'application/pdf', 184320,
     'demo@example.com', 'folder_contracts', 'https://drive.google.com/file/d/file_old_contract/view', false, true),
    (v_org_id, 'file_meeting_notes', 'Meeting Notes.txt', 'text/plain', 8192,
     'demo@example.com', 'folder_documents', 'https://drive.google.com/file/d/file_meeting_notes/view', false, false)
  ON CONFLICT (organization_id, drive_file_id) DO NOTHING;

  -- Get file IDs for attachments
  SELECT id INTO v_file_id_1 FROM drive_files WHERE drive_file_id = 'file_contract_001' AND organization_id = v_org_id;
  SELECT id INTO v_file_id_2 FROM drive_files WHERE drive_file_id = 'file_proposal_001' AND organization_id = v_org_id;
  SELECT id INTO v_file_id_3 FROM drive_files WHERE drive_file_id = 'file_photo_001' AND organization_id = v_org_id;
  SELECT id INTO v_file_id_4 FROM drive_files WHERE drive_file_id = 'file_old_contract' AND organization_id = v_org_id;

  -- Create file attachments to contacts
  IF v_contact_id_1 IS NOT NULL AND v_file_id_1 IS NOT NULL THEN
    INSERT INTO file_attachments (organization_id, drive_file_id, entity_type, entity_id, attached_by, note)
    VALUES
      (v_org_id, v_file_id_1, 'contacts', v_contact_id_1, v_user_id, 'Signed service agreement'),
      (v_org_id, v_file_id_2, 'contacts', v_contact_id_1, v_user_id, 'Initial proposal sent')
    ON CONFLICT (drive_file_id, entity_type, entity_id) DO NOTHING;
  END IF;

  IF v_contact_id_2 IS NOT NULL AND v_file_id_3 IS NOT NULL THEN
    INSERT INTO file_attachments (organization_id, drive_file_id, entity_type, entity_id, attached_by, note)
    VALUES
      (v_org_id, v_file_id_3, 'contacts', v_contact_id_2, v_user_id, 'Event photo'),
      (v_org_id, v_file_id_4, 'contacts', v_contact_id_2, v_user_id, 'Previous contract - access revoked')
    ON CONFLICT (drive_file_id, entity_type, entity_id) DO NOTHING;
  END IF;

END $$;
