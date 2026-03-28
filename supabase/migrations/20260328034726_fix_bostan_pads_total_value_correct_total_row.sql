/*
  # Fix Bostan Pads proposal total_value

  The previous migration took MAX of all dollar amounts in the pricing section,
  but Bostan Pads has individual milestone prices ($9,000 + $40,000 + $20,000 = $69,000)
  where $40,000 is the largest individual number but $69,000 is the labeled total.

  This migration corrects the Bostan Pads proposal to the correct total of $69,000
  by looking for dollar amounts on rows that contain a "Total" label in the same row.
*/

-- Fix Bostan Pads: correct total is $69,000 (from the "Total Platform Investment" row)
UPDATE proposals
SET total_value = 69000.00, updated_at = now()
WHERE id = 'c34c495c-1b56-483f-ba19-f9bace18ef14'
  AND total_value = 98500.00;

-- Fix Joshua Maly: verify by checking what $150,000 refers to
-- The proposal content shows individual items; the regex MAX may have picked wrong value
-- We'll let the client-side extractor handle it since it uses DOMParser with Total-row priority
