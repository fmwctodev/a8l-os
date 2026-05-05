#!/usr/bin/env node
/**
 * One-time LeadConnector → CSV export for the Phase D data migration.
 *
 * Reads contacts from LeadConnector / GoHighLevel via their REST API,
 * paginates through every page, normalizes the SMS-consent fields, and
 * writes a CSV that matches the staging-table schema in
 * docs/ghl-migration/phase-d-leadconnector-data-migration.md.
 *
 * Usage:
 *   LEADCONNECTOR_API_KEY=pit-...  \
 *   LEADCONNECTOR_LOCATION_ID=loc_...  \
 *   node scripts/export-leadconnector-contacts.mjs > leadconnector-contacts-export.csv
 *
 * Or with a file output:
 *   node scripts/export-leadconnector-contacts.mjs --out=leadconnector-contacts-export.csv
 *
 * The API key needs `contacts.readonly` scope (private integration token works).
 *
 * IMPORTANT — TCPA compliance: this script preserves the ORIGINAL consent timestamp
 * from LeadConnector under the `sms_opt_in_date` column. The Phase D import SQL
 * stores it in the contact's sms_consent custom field value as
 * `original_consent_at`, which is the legal chain-of-custody for a TCPA audit.
 * Do not modify the timestamp during transformation.
 */

import { createWriteStream } from "node:fs";
import process from "node:process";

const API_BASE = "https://services.leadconnectorhq.com";
const PAGE_SIZE = 100;

const apiKey = process.env.LEADCONNECTOR_API_KEY;
const locationId = process.env.LEADCONNECTOR_LOCATION_ID;
if (!apiKey || !locationId) {
  console.error("Missing LEADCONNECTOR_API_KEY or LEADCONNECTOR_LOCATION_ID env vars.");
  process.exit(1);
}

const outArg = process.argv.find((a) => a.startsWith("--out="));
const outPath = outArg ? outArg.slice("--out=".length) : null;
const outStream = outPath ? createWriteStream(outPath) : process.stdout;

// Stable column order — the Phase D staging table is defined to match this.
const COLUMNS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "job_title",
  "city",
  "state",
  "postal_code",
  "country",
  "source",
  "tags",
  "date_added",
  "sms_opt_in",
  "sms_opt_in_date",
  "industry",
  "notes",
];

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeRow(row) {
  outStream.write(COLUMNS.map((c) => csvEscape(row[c])).join(",") + "\n");
}

// Header
outStream.write(COLUMNS.join(",") + "\n");

// Helpers — LeadConnector API stores standard fields top-level and custom
// fields under contact.customField (an array of {id, value}). The
// extractCustomField helper looks up by configured ID. Adjust the IDs below
// to match YOUR LeadConnector custom fields — find them in
// LeadConnector Settings → Custom Fields → click each field → URL contains the ID.
const CUSTOM_FIELD_IDS = {
  // Replace these placeholders with your actual LeadConnector custom field UUIDs
  // before running. Set any you don't have to null and they'll be skipped.
  industry: process.env.LC_FIELD_INDUSTRY || null,
  sms_opt_in: process.env.LC_FIELD_SMS_OPT_IN || null,
  sms_opt_in_date: process.env.LC_FIELD_SMS_OPT_IN_DATE || null,
};

function extractCustomField(contact, fieldId) {
  if (!fieldId || !Array.isArray(contact.customField)) return null;
  const f = contact.customField.find((cf) => cf.id === fieldId);
  return f ? f.value : null;
}

let page = 1;
let totalExported = 0;
let cursor = null;

while (true) {
  const params = new URLSearchParams({
    locationId,
    limit: String(PAGE_SIZE),
  });
  if (cursor) params.set("startAfterId", cursor);

  const url = `${API_BASE}/contacts/?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: "2021-07-28",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`LeadConnector API error ${res.status}: ${body}`);
    process.exit(1);
  }

  const data = await res.json();
  const contacts = data.contacts || data.data || [];
  if (contacts.length === 0) break;

  for (const c of contacts) {
    const tags = Array.isArray(c.tags) ? c.tags.join("|") : c.tags || "";
    const smsOptIn = extractCustomField(c, CUSTOM_FIELD_IDS.sms_opt_in);
    const smsOptInDate = extractCustomField(c, CUSTOM_FIELD_IDS.sms_opt_in_date);
    const industry = extractCustomField(c, CUSTOM_FIELD_IDS.industry);

    writeRow({
      id: c.id,
      first_name: c.firstName || c.firstNameLowerCase || "",
      last_name: c.lastName || c.lastNameLowerCase || "",
      email: c.email,
      phone: c.phone,
      company: c.companyName,
      job_title: c.jobTitle,
      city: c.city,
      state: c.state,
      postal_code: c.postalCode,
      country: c.country,
      source: c.source,
      tags,
      date_added: c.dateAdded,
      // Truthy strings → boolean t/f; null preserves NULL
      sms_opt_in:
        smsOptIn === null
          ? ""
          : ["true", "1", "yes", "y"].includes(String(smsOptIn).toLowerCase())
          ? "true"
          : "false",
      sms_opt_in_date: smsOptInDate || "",
      industry: industry || "",
      notes: "",
    });
    totalExported++;
  }

  // Pagination — LeadConnector returns the last contact's ID; pass it as
  // startAfterId on the next request. Stop when fewer than PAGE_SIZE come back.
  cursor = contacts[contacts.length - 1]?.id || null;
  if (contacts.length < PAGE_SIZE) break;
  page++;
}

if (outStream !== process.stdout) outStream.end();
console.error(`Exported ${totalExported} contacts (${page} pages).`);
