import type { SurveyQuestionType, SurveyQuestionOption } from '../types';

export interface SurveyTemplateQuestion {
  type: SurveyQuestionType;
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Omit<SurveyQuestionOption, 'id'>[];
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface SurveyTemplateStep {
  title?: string;
  description?: string;
  questions: SurveyTemplateQuestion[];
}

export interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  steps: SurveyTemplateStep[];
  oneQuestionPerStep?: boolean;
}

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'paid-ad-qualification',
    name: 'Paid-Ad Lead Qualification',
    description: 'Per the spec: 5-slide funnel — service, owner, urgency, location, contact. Built for paid traffic.',
    oneQuestionPerStep: true,
    steps: [
      {
        title: 'What service do you need?',
        questions: [
          {
            type: 'multiple_choice',
            label: 'What type of service do you need?',
            required: true,
            options: [
              { label: 'Roof repair', value: 'roof_repair', score: 0 },
              { label: 'Full roof replacement', value: 'roof_replacement', score: 0 },
              { label: 'Storm damage', value: 'storm', score: 0 },
              { label: 'Siding', value: 'siding', score: 0 },
              { label: 'Gutters', value: 'gutters', score: 0 },
            ],
          },
        ],
      },
      {
        title: 'Are you the property owner?',
        questions: [
          {
            type: 'multiple_choice',
            label: 'Are you the property owner?',
            required: true,
            options: [
              { label: 'Yes', value: 'yes', score: 1 },
              { label: 'No', value: 'no', score: 0 },
            ],
          },
        ],
      },
      {
        title: 'How soon do you need help?',
        questions: [
          {
            type: 'multiple_choice',
            label: 'How soon do you need help?',
            required: true,
            options: [
              { label: 'Emergency / today', value: 'emergency', score: 3 },
              { label: 'This week', value: 'this_week', score: 2 },
              { label: 'This month', value: 'this_month', score: 1 },
              { label: 'Just researching', value: 'researching', score: 0 },
            ],
          },
        ],
      },
      {
        title: 'Where is the project located?',
        questions: [
          { type: 'address', label: 'Property address', required: true },
          { type: 'city', label: 'City' },
          { type: 'state', label: 'State' },
          { type: 'postal_code', label: 'Zip code' },
        ],
      },
      {
        title: 'How do we reach you?',
        questions: [
          { type: 'first_name', label: 'First name', required: true },
          { type: 'last_name', label: 'Last name', required: true },
          { type: 'phone', label: 'Phone', required: true },
          { type: 'email', label: 'Email', required: true },
        ],
      },
    ],
  },
  {
    id: 'high-ticket-application',
    name: 'High-Ticket Application',
    description: 'For coaching, consulting, or B2B — qualify based on outcome, timeline, budget, decision-making.',
    oneQuestionPerStep: true,
    steps: [
      {
        title: 'What are you looking for help with?',
        questions: [
          { type: 'long_answer', label: 'In a few sentences, what are you trying to solve?', required: true },
        ],
      },
      {
        title: 'Where are you today?',
        questions: [
          { type: 'long_answer', label: 'What is your current situation?', required: true },
        ],
      },
      {
        title: 'Where do you want to be?',
        questions: [
          { type: 'long_answer', label: 'What does success look like for you?', required: true },
        ],
      },
      {
        title: 'When do you want this?',
        questions: [
          {
            type: 'multiple_choice',
            label: 'What is your timeline?',
            required: true,
            options: [
              { label: 'Within the next 30 days', value: '30d', score: 3 },
              { label: '1–3 months', value: '1_3m', score: 2 },
              { label: '3–6 months', value: '3_6m', score: 1 },
              { label: 'Longer than 6 months', value: '6m_plus', score: 0 },
            ],
          },
        ],
      },
      {
        title: 'What is your budget?',
        questions: [
          {
            type: 'multiple_choice',
            label: 'What is your budget for this?',
            required: true,
            options: [
              { label: 'Under $1,000', value: 'under_1k', score: 0 },
              { label: '$1,000 – $5,000', value: '1k_5k', score: 1 },
              { label: '$5,000 – $15,000', value: '5k_15k', score: 2 },
              { label: '$15,000+', value: '15k_plus', score: 3 },
            ],
          },
        ],
      },
      {
        title: 'Are you the decision maker?',
        questions: [
          {
            type: 'multiple_choice',
            label: 'Are you the decision maker?',
            required: true,
            options: [
              { label: 'Yes, I make this decision', value: 'yes', score: 2 },
              { label: 'I share the decision', value: 'shared', score: 1 },
              { label: 'No, someone else decides', value: 'no', score: 0 },
            ],
          },
        ],
      },
      {
        title: 'How can we reach you?',
        questions: [
          { type: 'first_name', label: 'First name', required: true },
          { type: 'last_name', label: 'Last name', required: true },
          { type: 'email', label: 'Email', required: true },
          { type: 'phone', label: 'Phone', required: true },
          { type: 'company', label: 'Company (optional)' },
        ],
      },
      {
        title: 'Almost done.',
        description: 'Pick a time that works for you on the next page.',
        questions: [
          { type: 'long_answer', label: 'Anything else we should know before our call?' },
        ],
      },
    ],
  },
  {
    id: 'nps-feedback',
    name: 'Customer Feedback (NPS)',
    description: 'Net Promoter Score + open follow-up. Short survey for measuring customer satisfaction.',
    steps: [
      {
        title: 'How likely are you to recommend us?',
        questions: [
          {
            type: 'nps',
            label: 'How likely are you to recommend us to a friend or colleague?',
            required: true,
            minValue: 0,
            maxValue: 10,
            minLabel: 'Not at all likely',
            maxLabel: 'Extremely likely',
          },
        ],
      },
      {
        title: 'Tell us why',
        questions: [
          { type: 'long_answer', label: 'What is the main reason for your score?', required: true },
          { type: 'long_answer', label: 'What could we do to improve?' },
        ],
      },
      {
        title: 'One last thing',
        questions: [
          { type: 'email', label: 'Email (optional, if you want a follow-up)' },
        ],
      },
    ],
  },
];
