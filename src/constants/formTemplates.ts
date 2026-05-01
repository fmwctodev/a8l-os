import type { FormFieldType, FormFieldOption } from '../types';

export interface FormTemplateField {
  type: FormFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: FormFieldOption[];
  helpText?: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  fields: FormTemplateField[];
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'simple-lead-capture',
    name: 'Simple Lead Capture',
    description: 'First name, last name, email, phone, what they need, message. The classic.',
    fields: [
      { type: 'first_name', label: 'First Name', required: true, placeholder: 'Jane' },
      { type: 'last_name', label: 'Last Name', required: true, placeholder: 'Doe' },
      { type: 'email', label: 'Email', required: true, placeholder: 'you@example.com' },
      { type: 'phone', label: 'Phone', required: true, placeholder: '(555) 555-5555' },
      {
        type: 'dropdown',
        label: 'Service Needed',
        required: true,
        options: [
          { label: 'General Inquiry', value: 'general' },
          { label: 'Quote Request', value: 'quote' },
          { label: 'Support', value: 'support' },
          { label: 'Other', value: 'other' },
        ],
      },
      { type: 'textarea', label: 'Message / Notes', placeholder: 'Tell us a bit about what you need...' },
    ],
  },
  {
    id: 'quote-request',
    name: 'Quote Request',
    description: 'For service businesses — captures contact, service, project details, budget, timeline.',
    fields: [
      { type: 'first_name', label: 'First Name', required: true },
      { type: 'last_name', label: 'Last Name', required: true },
      { type: 'email', label: 'Email', required: true },
      { type: 'phone', label: 'Phone', required: true },
      { type: 'address', label: 'Project Address', required: true },
      { type: 'city', label: 'City' },
      { type: 'state', label: 'State' },
      { type: 'postal_code', label: 'Zip' },
      {
        type: 'dropdown',
        label: 'Service Needed',
        required: true,
        options: [
          { label: 'New Installation', value: 'new_install' },
          { label: 'Repair', value: 'repair' },
          { label: 'Maintenance', value: 'maintenance' },
          { label: 'Inspection / Estimate', value: 'inspection' },
          { label: 'Other', value: 'other' },
        ],
      },
      {
        type: 'radio',
        label: 'When do you need this?',
        required: true,
        options: [
          { label: 'Emergency / ASAP', value: 'emergency' },
          { label: 'Within 1 week', value: 'this_week' },
          { label: 'Within 1 month', value: 'this_month' },
          { label: 'Just researching', value: 'researching' },
        ],
      },
      {
        type: 'dropdown',
        label: 'Budget Range',
        options: [
          { label: 'Under $1,000', value: 'under_1k' },
          { label: '$1,000 – $5,000', value: '1k_5k' },
          { label: '$5,000 – $15,000', value: '5k_15k' },
          { label: '$15,000+', value: '15k_plus' },
        ],
      },
      { type: 'textarea', label: 'Project Details', placeholder: 'Tell us about the project...' },
    ],
  },
  {
    id: 'contact-form',
    name: 'Contact Form',
    description: 'Minimal contact form: full name, email, phone, subject, message.',
    fields: [
      { type: 'full_name', label: 'Full Name', required: true },
      { type: 'email', label: 'Email', required: true },
      { type: 'phone', label: 'Phone' },
      { type: 'text', label: 'Subject', required: true, placeholder: 'What is this about?' },
      { type: 'textarea', label: 'Message', required: true, placeholder: 'How can we help?' },
      { type: 'consent', label: 'I agree to be contacted about my inquiry.', required: true },
    ],
  },
  {
    id: 'roofing-estimate',
    name: 'Roofing Estimate',
    description: 'From the spec: roofing-specific lead capture with property + damage upload.',
    fields: [
      { type: 'first_name', label: 'First Name', required: true },
      { type: 'last_name', label: 'Last Name', required: true },
      { type: 'phone', label: 'Phone', required: true },
      { type: 'email', label: 'Email', required: true },
      { type: 'address', label: 'Property Address', required: true },
      {
        type: 'dropdown',
        label: 'Service Needed',
        required: true,
        options: [
          { label: 'Roof Repair', value: 'repair' },
          { label: 'Full Roof Replacement', value: 'replacement' },
          { label: 'Storm Damage Inspection', value: 'storm' },
          { label: 'Emergency Tarping', value: 'tarping' },
          { label: 'Insurance Claim Help', value: 'claim' },
        ],
      },
      {
        type: 'radio',
        label: 'Roof Type',
        options: [
          { label: 'Asphalt Shingles', value: 'asphalt' },
          { label: 'Metal', value: 'metal' },
          { label: 'Tile', value: 'tile' },
          { label: 'Flat / Membrane', value: 'flat' },
          { label: 'Not sure', value: 'unknown' },
        ],
      },
      {
        type: 'radio',
        label: 'Insurance Claim?',
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
          { label: 'Considering it', value: 'maybe' },
        ],
      },
      { type: 'file_upload', label: 'Upload Damage Photos' },
      { type: 'date', label: 'Preferred Inspection Date' },
      { type: 'textarea', label: 'Notes', placeholder: 'Anything else we should know?' },
    ],
  },
];
