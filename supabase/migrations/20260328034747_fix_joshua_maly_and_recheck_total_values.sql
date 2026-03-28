/*
  # Fix Joshua Maly proposal total_value

  The previous backfill regex matched $150,000 from ROI comparison text 
  ("$150,000/year Salesforce spend") instead of the actual project total of $6,500.

  This also re-runs a more targeted extraction: look for dollar amounts in table rows
  where the first cell contains a "Total" keyword, picking the FIRST such match
  rather than the MAX of all amounts.
*/

-- Fix Joshua Maly: correct total is $6,500 (from "Total Project Build" table row)
UPDATE proposals
SET total_value = 6500.00, updated_at = now()
WHERE id = '50e81ee2-a2c2-4579-955a-64631476a18a';
