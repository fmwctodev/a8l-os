/*
  # Disable SendGrid click tracking default

  1. Changes
    - Sets `track_clicks` to `false` in `email_defaults` for all organizations
    - SendGrid click tracking rewrites all URLs in emails through a redirect proxy,
      which corrupts query parameters (e.g. ?token=...) on signing links and other
      transactional URLs, causing them to break for recipients

  2. Impact
    - All outbound emails will no longer have links rewritten by SendGrid
    - Open tracking remains enabled (uses an invisible pixel, not URL rewriting)
    - This fixes broken proposal signing, contract signing, and approval links
*/

UPDATE email_defaults
SET track_clicks = false
WHERE track_clicks = true;
