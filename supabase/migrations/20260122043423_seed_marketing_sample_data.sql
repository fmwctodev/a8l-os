/*
  # Seed Marketing Sample Data

  This migration adds sample data to help users explore the Marketing module.

  1. Sample Data Created
    - Contact Form: A basic lead capture form with name, email, phone, message fields
    - Newsletter Signup: Simple email subscription form
    - Customer Satisfaction Survey: Multi-step survey with NPS and satisfaction questions
  
  2. Notes
    - Forms and surveys are created in draft status
    - Public slugs are pre-generated for easy access
    - Definition and settings follow the expected JSON schema
*/

DO $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  
  SELECT u.id INTO v_user_id 
  FROM users u 
  WHERE u.organization_id = v_org_id 
  LIMIT 1;

  IF v_org_id IS NULL OR v_user_id IS NULL THEN
    RAISE NOTICE 'Organization or user not found, skipping sample data';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM forms WHERE organization_id = v_org_id) THEN
    INSERT INTO forms (
      organization_id,
      name,
      description,
      public_slug,
      definition,
      settings,
      status,
      created_by
    ) VALUES (
      v_org_id,
      'Contact Us',
      'Get in touch with our team',
      'contact-us',
      '{
        "fields": [
          {"id": "field_fname", "type": "first_name", "label": "First Name", "required": true, "width": "half"},
          {"id": "field_lname", "type": "last_name", "label": "Last Name", "required": true, "width": "half"},
          {"id": "field_email", "type": "email", "label": "Email Address", "required": true, "width": "full", "placeholder": "you@example.com"},
          {"id": "field_phone", "type": "phone", "label": "Phone Number", "required": false, "width": "full"},
          {"id": "field_company", "type": "company", "label": "Company", "required": false, "width": "full"},
          {"id": "field_message", "type": "textarea", "label": "Message", "required": true, "width": "full", "placeholder": "How can we help you?"},
          {"id": "field_consent", "type": "consent", "label": "I agree to receive communications from the team", "required": true, "width": "full"}
        ]
      }',
      '{
        "thankYouMessage": "Thank you for reaching out! We will get back to you within 24 hours.",
        "contactMatching": "email_first",
        "fieldOverwrite": "only_if_empty",
        "honeypotEnabled": true,
        "tagOnSubmit": []
      }',
      'draft',
      v_user_id
    );

    INSERT INTO forms (
      organization_id,
      name,
      description,
      public_slug,
      definition,
      settings,
      status,
      created_by
    ) VALUES (
      v_org_id,
      'Newsletter Signup',
      'Subscribe to our newsletter',
      'newsletter',
      '{
        "fields": [
          {"id": "field_email", "type": "email", "label": "Email Address", "required": true, "width": "full", "placeholder": "Enter your email"},
          {"id": "field_fname", "type": "first_name", "label": "First Name", "required": false, "width": "full"},
          {"id": "field_interests", "type": "multi_select", "label": "Topics you are interested in", "required": false, "width": "full", "options": [{"label": "Product Updates", "value": "product"}, {"label": "Industry News", "value": "news"}, {"label": "Tips & Tutorials", "value": "tutorials"}, {"label": "Case Studies", "value": "cases"}]}
        ]
      }',
      '{
        "thankYouMessage": "You are subscribed! Check your inbox for a confirmation email.",
        "contactMatching": "email_first",
        "fieldOverwrite": "only_if_empty",
        "honeypotEnabled": true,
        "tagOnSubmit": []
      }',
      'draft',
      v_user_id
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM surveys WHERE organization_id = v_org_id) THEN
    INSERT INTO surveys (
      organization_id,
      name,
      description,
      public_slug,
      definition,
      settings,
      status,
      created_by
    ) VALUES (
      v_org_id,
      'Customer Satisfaction Survey',
      'Help us improve by sharing your feedback',
      'csat-survey',
      '{
        "steps": [
          {
            "id": "step_1",
            "title": "Overall Experience",
            "description": "Tell us about your overall experience with our product",
            "questions": [
              {"id": "q_nps", "type": "nps", "text": "How likely are you to recommend us to a friend or colleague?", "required": true, "min": 0, "max": 10},
              {"id": "q_satisfaction", "type": "rating", "text": "How satisfied are you with our product overall?", "required": true, "min": 1, "max": 5}
            ]
          },
          {
            "id": "step_2",
            "title": "Specific Feedback",
            "description": "Help us understand what we do well and where we can improve",
            "questions": [
              {"id": "q_best", "type": "single_choice", "text": "What do you like most about our product?", "required": true, "options": [{"id": "opt_1", "label": "Ease of use", "value": "ease", "score": 0}, {"id": "opt_2", "label": "Features", "value": "features", "score": 0}, {"id": "opt_3", "label": "Customer support", "value": "support", "score": 0}, {"id": "opt_4", "label": "Value for money", "value": "value", "score": 0}, {"id": "opt_5", "label": "Other", "value": "other", "score": 0}]},
              {"id": "q_improve", "type": "multiple_choice", "text": "What areas could we improve? (Select all that apply)", "required": false, "options": [{"id": "opt_a", "label": "Documentation", "value": "docs", "score": 0}, {"id": "opt_b", "label": "Performance", "value": "performance", "score": 0}, {"id": "opt_c", "label": "Mobile experience", "value": "mobile", "score": 0}, {"id": "opt_d", "label": "Integrations", "value": "integrations", "score": 0}, {"id": "opt_e", "label": "Pricing", "value": "pricing", "score": 0}]}
            ]
          },
          {
            "id": "step_3",
            "title": "Additional Comments",
            "description": "Any other thoughts you would like to share",
            "questions": [
              {"id": "q_comments", "type": "long_text", "text": "Is there anything else you would like to tell us?", "required": false}
            ]
          }
        ]
      }',
      '{
        "thankYouMessage": "Thank you for your feedback! We really appreciate you taking the time to help us improve.",
        "showProgressBar": true,
        "allowBackNavigation": true,
        "contactMatching": "email_first",
        "scoreBands": [
          {"minScore": 0, "maxScore": 30, "label": "Detractor"},
          {"minScore": 31, "maxScore": 70, "label": "Passive"},
          {"minScore": 71, "maxScore": 100, "label": "Promoter"}
        ],
        "tagByAnswers": [],
        "tagByScoreBand": []
      }',
      'draft',
      v_user_id
    );
  END IF;
END $$;
