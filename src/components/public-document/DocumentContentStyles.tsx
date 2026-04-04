export function DocumentContentStyles({ accentColor }: { accentColor: string }) {
  return (
    <style>{`
      .doc-section-body {
        background: #1e293b;
        border-radius: 12px;
        padding: 24px 28px;
        color: #cbd5e1;
        font-size: 14px;
        line-height: 1.65;
      }
      .doc-section-body h2,
      .doc-section-body h3,
      .doc-section-body h4 {
        color: #f1f5f9;
        font-weight: 700;
        margin-top: 18px;
        margin-bottom: 8px;
      }
      .doc-section-body h2 { font-size: 18px; }
      .doc-section-body h3 { font-size: 16px; }
      .doc-section-body h4 { font-size: 15px; }
      .doc-section-body h2:first-child,
      .doc-section-body h3:first-child,
      .doc-section-body h4:first-child { margin-top: 0; }
      .doc-section-body p {
        margin-bottom: 10px;
      }
      .doc-section-body p:last-child {
        margin-bottom: 0;
      }
      .doc-section-body strong,
      .doc-section-body b {
        color: #f1f5f9;
        font-weight: 600;
      }
      .doc-section-body em,
      .doc-section-body i {
        color: #e2e8f0;
      }
      .doc-section-body a {
        color: ${accentColor};
        text-decoration: none;
      }
      .doc-section-body a:hover {
        text-decoration: underline;
      }
      .doc-section-body blockquote {
        border-left: 3px solid ${accentColor};
        padding-left: 16px;
        margin: 12px 0;
        color: #94a3b8;
        font-style: italic;
      }
      .doc-section-body hr {
        border: none;
        border-top: 1px solid rgba(51,65,85,0.6);
        margin: 16px 0;
      }

      /* Lists with check icons */
      .doc-section-body ul,
      .doc-section-body ol {
        list-style: none;
        padding: 0;
        margin: 8px 0 12px 0;
      }
      .doc-section-body li {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid rgba(51,65,85,0.4);
        font-size: 14px;
        color: #cbd5e1;
      }
      .doc-section-body li:last-child {
        border-bottom: none;
      }
      .doc-section-body li::before {
        content: '';
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        margin-top: 2px;
        background-image: url("data:image/svg+xml,%3Csvg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%2322d3ee' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22 4 12 14.01 9 11.01'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-size: contain;
      }

      /* Tables */
      .doc-section-body table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
        font-size: 13px;
      }
      .doc-section-body thead {
        background: #162032;
      }
      .doc-section-body th {
        text-align: left;
        padding: 12px 16px;
        font-weight: 600;
        color: #f1f5f9;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 2px solid #334155;
      }
      .doc-section-body td {
        padding: 10px 16px;
        border-bottom: 1px solid rgba(51,65,85,0.4);
        color: #cbd5e1;
        vertical-align: top;
      }
      .doc-section-body tr:last-child td {
        border-bottom: none;
      }
      .doc-section-body tbody tr:hover {
        background: rgba(30,41,59,0.5);
      }
      .doc-section-body td:first-child {
        color: #e2e8f0;
        font-weight: 500;
      }

      /* Code */
      .doc-section-body code {
        background: #162032;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 13px;
        color: ${accentColor};
      }
      .doc-section-body pre {
        background: #162032;
        padding: 16px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 12px 0;
      }
      .doc-section-body pre code {
        background: none;
        padding: 0;
      }
    `}</style>
  );
}
