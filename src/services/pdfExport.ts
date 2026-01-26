import type { DashboardAnalytics } from './userDashboardAnalytics';
import type { ContentAIAnalytics } from './contentAIAnalytics';
import { formatCurrency } from './analyticsEngine';

interface PDFStyles {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  lineHeight: number;
  fontSize: {
    title: number;
    heading: number;
    subheading: number;
    body: number;
    small: number;
  };
  colors: {
    primary: string;
    secondary: string;
    text: string;
    muted: string;
    success: string;
    danger: string;
    border: string;
  };
}

const defaultStyles: PDFStyles = {
  pageWidth: 612,
  pageHeight: 792,
  margin: 50,
  lineHeight: 1.4,
  fontSize: {
    title: 24,
    heading: 16,
    subheading: 12,
    body: 10,
    small: 8,
  },
  colors: {
    primary: '#1e40af',
    secondary: '#3b82f6',
    text: '#1f2937',
    muted: '#6b7280',
    success: '#059669',
    danger: '#dc2626',
    border: '#e5e7eb',
  },
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDelta(value: number): string {
  if (value > 0) return `+${value}%`;
  if (value < 0) return `${value}%`;
  return '0%';
}

function getTrendSymbol(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return '(up)';
    case 'down': return '(down)';
    default: return '(-)';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateDashboardHTML(
  data: DashboardAnalytics,
  organizationName: string,
  timeRangeLabel: string
): string {
  const styles = defaultStyles;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Dashboard Analytics Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: ${styles.colors.text};
      line-height: ${styles.lineHeight};
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid ${styles.colors.primary};
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: ${styles.fontSize.title}px;
      color: ${styles.colors.primary};
      margin-bottom: 8px;
    }
    .header .subtitle {
      color: ${styles.colors.muted};
      font-size: ${styles.fontSize.body}px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      font-size: ${styles.fontSize.heading}px;
      color: ${styles.colors.primary};
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid ${styles.colors.border};
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    .metric-card {
      background: #f9fafb;
      border: 1px solid ${styles.colors.border};
      border-radius: 8px;
      padding: 15px;
    }
    .metric-card .label {
      font-size: ${styles.fontSize.small}px;
      color: ${styles.colors.muted};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .metric-card .value {
      font-size: ${styles.fontSize.heading}px;
      font-weight: 600;
      color: ${styles.colors.text};
    }
    .metric-card .delta {
      font-size: ${styles.fontSize.small}px;
      margin-top: 5px;
    }
    .delta.positive { color: ${styles.colors.success}; }
    .delta.negative { color: ${styles.colors.danger}; }
    .delta.neutral { color: ${styles.colors.muted}; }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    .summary-table th,
    .summary-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid ${styles.colors.border};
      font-size: ${styles.fontSize.body}px;
    }
    .summary-table th {
      background: #f3f4f6;
      font-weight: 600;
      color: ${styles.colors.text};
    }
    .summary-table td.number {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid ${styles.colors.border};
      font-size: ${styles.fontSize.small}px;
      color: ${styles.colors.muted};
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Dashboard Analytics Report</h1>
    <div class="subtitle">
      ${escapeHtml(organizationName)} | ${escapeHtml(timeRangeLabel)} | Generated ${formatDate(new Date())}
    </div>
  </div>

  <div class="section">
    <h2>Contacts</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="label">Total Contacts</div>
        <div class="value">${data.contacts.total.toLocaleString()}</div>
      </div>
      <div class="metric-card">
        <div class="label">New This Period</div>
        <div class="value">${data.contacts.newInPeriod.current.toLocaleString()}</div>
        <div class="delta ${data.contacts.newInPeriod.trend === 'up' ? 'positive' : data.contacts.newInPeriod.trend === 'down' ? 'negative' : 'neutral'}">
          ${formatDelta(data.contacts.newInPeriod.deltaPercent)} ${getTrendSymbol(data.contacts.newInPeriod.trend)}
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Conversations</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="label">Active Conversations</div>
        <div class="value">${data.conversations.active.toLocaleString()}</div>
      </div>
      <div class="metric-card">
        <div class="label">Messages Sent</div>
        <div class="value">${data.conversations.messagesSent.current.toLocaleString()}</div>
        <div class="delta ${data.conversations.messagesSent.trend === 'up' ? 'positive' : data.conversations.messagesSent.trend === 'down' ? 'negative' : 'neutral'}">
          ${formatDelta(data.conversations.messagesSent.deltaPercent)} ${getTrendSymbol(data.conversations.messagesSent.trend)}
        </div>
      </div>
      <div class="metric-card">
        <div class="label">Response Rate</div>
        <div class="value">${data.conversations.responseRate.current}%</div>
        <div class="delta ${data.conversations.responseRate.trend === 'up' ? 'positive' : data.conversations.responseRate.trend === 'down' ? 'negative' : 'neutral'}">
          ${formatDelta(data.conversations.responseRate.deltaPercent)} ${getTrendSymbol(data.conversations.responseRate.trend)}
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Opportunities</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="label">Open Opportunities</div>
        <div class="value">${data.opportunities.open.toLocaleString()}</div>
      </div>
      <div class="metric-card">
        <div class="label">Pipeline Value</div>
        <div class="value">${formatCurrency(data.opportunities.pipelineValue.current)}</div>
        <div class="delta ${data.opportunities.pipelineValue.trend === 'up' ? 'positive' : data.opportunities.pipelineValue.trend === 'down' ? 'negative' : 'neutral'}">
          ${formatDelta(data.opportunities.pipelineValue.deltaPercent)} ${getTrendSymbol(data.opportunities.pipelineValue.trend)}
        </div>
      </div>
      <div class="metric-card">
        <div class="label">Win Rate</div>
        <div class="value">${data.opportunities.winRate.current}%</div>
        <div class="delta ${data.opportunities.winRate.trend === 'up' ? 'positive' : data.opportunities.winRate.trend === 'down' ? 'negative' : 'neutral'}">
          ${formatDelta(data.opportunities.winRate.deltaPercent)} ${getTrendSymbol(data.opportunities.winRate.trend)}
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Appointments</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="label">Upcoming</div>
        <div class="value">${data.appointments.upcoming.toLocaleString()}</div>
      </div>
      <div class="metric-card">
        <div class="label">Completed This Period</div>
        <div class="value">${data.appointments.completedInPeriod.current.toLocaleString()}</div>
        <div class="delta ${data.appointments.completedInPeriod.trend === 'up' ? 'positive' : data.appointments.completedInPeriod.trend === 'down' ? 'negative' : 'neutral'}">
          ${formatDelta(data.appointments.completedInPeriod.deltaPercent)} ${getTrendSymbol(data.appointments.completedInPeriod.trend)}
        </div>
      </div>
      <div class="metric-card">
        <div class="label">No-Show Rate</div>
        <div class="value">${data.appointments.noShowRate.current}%</div>
        <div class="delta ${data.appointments.noShowRate.trend === 'down' ? 'positive' : data.appointments.noShowRate.trend === 'up' ? 'negative' : 'neutral'}">
          ${formatDelta(data.appointments.noShowRate.deltaPercent)} ${getTrendSymbol(data.appointments.noShowRate.trend)}
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Revenue</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="label">Invoiced This Period</div>
        <div class="value">${formatCurrency(data.revenue.invoicedInPeriod.current)}</div>
        <div class="delta ${data.revenue.invoicedInPeriod.trend === 'up' ? 'positive' : data.revenue.invoicedInPeriod.trend === 'down' ? 'negative' : 'neutral'}">
          ${formatDelta(data.revenue.invoicedInPeriod.deltaPercent)} ${getTrendSymbol(data.revenue.invoicedInPeriod.trend)}
        </div>
      </div>
      <div class="metric-card">
        <div class="label">Paid This Period</div>
        <div class="value">${formatCurrency(data.revenue.paidInPeriod.current)}</div>
        <div class="delta ${data.revenue.paidInPeriod.trend === 'up' ? 'positive' : data.revenue.paidInPeriod.trend === 'down' ? 'negative' : 'neutral'}">
          ${formatDelta(data.revenue.paidInPeriod.deltaPercent)} ${getTrendSymbol(data.revenue.paidInPeriod.trend)}
        </div>
      </div>
      <div class="metric-card">
        <div class="label">Outstanding</div>
        <div class="value">${formatCurrency(data.revenue.outstanding)}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    Report generated automatically. Data reflects the selected time period.
  </div>
</body>
</html>
  `.trim();
}

function generateContentAIHTML(
  data: ContentAIAnalytics,
  organizationName: string,
  timeRangeLabel: string
): string {
  const styles = defaultStyles;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Content AI Analytics Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: ${styles.colors.text};
      line-height: ${styles.lineHeight};
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid ${styles.colors.primary};
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: ${styles.fontSize.title}px;
      color: ${styles.colors.primary};
      margin-bottom: 8px;
    }
    .header .subtitle {
      color: ${styles.colors.muted};
      font-size: ${styles.fontSize.body}px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      font-size: ${styles.fontSize.heading}px;
      color: ${styles.colors.primary};
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid ${styles.colors.border};
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
    }
    .metric-card {
      background: #f9fafb;
      border: 1px solid ${styles.colors.border};
      border-radius: 8px;
      padding: 15px;
    }
    .metric-card .label {
      font-size: ${styles.fontSize.small}px;
      color: ${styles.colors.muted};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .metric-card .value {
      font-size: ${styles.fontSize.heading}px;
      font-weight: 600;
      color: ${styles.colors.text};
    }
    .metric-card .delta {
      font-size: ${styles.fontSize.small}px;
      margin-top: 5px;
    }
    .delta.positive { color: ${styles.colors.success}; }
    .delta.negative { color: ${styles.colors.danger}; }
    .delta.neutral { color: ${styles.colors.muted}; }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    .data-table th,
    .data-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid ${styles.colors.border};
      font-size: ${styles.fontSize.body}px;
    }
    .data-table th {
      background: #f3f4f6;
      font-weight: 600;
      color: ${styles.colors.text};
    }
    .data-table td.number {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .insight-card {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 12px;
    }
    .insight-card .title {
      font-weight: 600;
      color: ${styles.colors.primary};
      margin-bottom: 5px;
    }
    .insight-card .description {
      font-size: ${styles.fontSize.body}px;
      color: ${styles.colors.text};
      margin-bottom: 8px;
    }
    .insight-card .data-points {
      font-size: ${styles.fontSize.small}px;
      color: ${styles.colors.muted};
    }
    .confidence-badge {
      display: inline-block;
      font-size: ${styles.fontSize.small}px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
    }
    .confidence-high { background: #dcfce7; color: #166534; }
    .confidence-medium { background: #fef3c7; color: #92400e; }
    .confidence-low { background: #f3f4f6; color: #6b7280; }
    .hooks-list {
      list-style: none;
    }
    .hooks-list li {
      padding: 10px 0;
      border-bottom: 1px solid ${styles.colors.border};
      font-size: ${styles.fontSize.body}px;
    }
    .hooks-list li:last-child {
      border-bottom: none;
    }
    .hook-text {
      color: ${styles.colors.text};
      margin-bottom: 4px;
    }
    .hook-meta {
      font-size: ${styles.fontSize.small}px;
      color: ${styles.colors.muted};
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid ${styles.colors.border};
      font-size: ${styles.fontSize.small}px;
      color: ${styles.colors.muted};
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Content AI Analytics Report</h1>
    <div class="subtitle">
      ${escapeHtml(organizationName)} | ${escapeHtml(timeRangeLabel)} | Generated ${formatDate(new Date())}
    </div>
  </div>

  <div class="section">
    <h2>Overview</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="label">Total Posts</div>
        <div class="value">${data.overview.totalPosts.current.toLocaleString()}</div>
        <div class="delta ${data.overview.totalPosts.trend === 'up' ? 'positive' : data.overview.totalPosts.trend === 'down' ? 'negative' : 'neutral'}">
          ${formatDelta(data.overview.totalPosts.deltaPercent)} vs prev
        </div>
      </div>
      <div class="metric-card">
        <div class="label">Avg Engagement</div>
        <div class="value">${data.overview.avgEngagement.current}%</div>
        <div class="delta ${data.overview.avgEngagement.trend === 'up' ? 'positive' : data.overview.avgEngagement.trend === 'down' ? 'negative' : 'neutral'}">
          ${formatDelta(data.overview.avgEngagement.deltaPercent)} vs prev
        </div>
      </div>
      <div class="metric-card">
        <div class="label">Avg Reach</div>
        <div class="value">${data.overview.avgReach.current}%</div>
        <div class="delta ${data.overview.avgReach.trend === 'up' ? 'positive' : data.overview.avgReach.trend === 'down' ? 'negative' : 'neutral'}">
          ${formatDelta(data.overview.avgReach.deltaPercent)} vs prev
        </div>
      </div>
      <div class="metric-card">
        <div class="label">High Performers</div>
        <div class="value">${data.overview.highPerformerPercent}%</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Platform Performance</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>Platform</th>
          <th class="number">Posts</th>
          <th class="number">Avg Engagement</th>
          <th class="number">Avg Reach</th>
          <th>Best Media</th>
          <th>Best Hour</th>
        </tr>
      </thead>
      <tbody>
        ${data.platforms.map(p => `
          <tr>
            <td>${escapeHtml(p.platform.charAt(0).toUpperCase() + p.platform.slice(1))}</td>
            <td class="number">${p.postsCount}</td>
            <td class="number">${p.avgEngagement}%</td>
            <td class="number">${p.avgReach}%</td>
            <td>${escapeHtml(p.topMediaType)}</td>
            <td>${p.bestPostingHour > 12 ? `${p.bestPostingHour - 12}PM` : p.bestPostingHour === 12 ? '12PM' : `${p.bestPostingHour}AM`}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Content Type Performance</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>Media Type</th>
          <th class="number">Count</th>
          <th class="number">Avg Engagement</th>
          <th class="number">Avg Reach</th>
        </tr>
      </thead>
      <tbody>
        ${data.contentTypes.map(ct => `
          <tr>
            <td>${escapeHtml(ct.mediaType.charAt(0).toUpperCase() + ct.mediaType.slice(1))}</td>
            <td class="number">${ct.count}</td>
            <td class="number">${ct.avgEngagement}%</td>
            <td class="number">${ct.avgReach}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Caption Length Analysis</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>Length Range</th>
          <th class="number">Posts</th>
          <th class="number">Avg Engagement</th>
        </tr>
      </thead>
      <tbody>
        ${data.captionLengths.map(cl => `
          <tr>
            <td>${escapeHtml(cl.range)}</td>
            <td class="number">${cl.count}</td>
            <td class="number">${cl.avgEngagement}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  ${data.topHooks.length > 0 ? `
  <div class="section">
    <h2>Top Performing Hooks</h2>
    <ul class="hooks-list">
      ${data.topHooks.slice(0, 5).map(hook => `
        <li>
          <div class="hook-text">"${escapeHtml(hook.hookText.substring(0, 100))}${hook.hookText.length > 100 ? '...' : ''}"</div>
          <div class="hook-meta">
            ${escapeHtml(hook.platform)} | Engagement: ${hook.engagementScore}% | Reach: ${hook.reachScore}%
          </div>
        </li>
      `).join('')}
    </ul>
  </div>
  ` : ''}

  ${data.timing.length > 0 ? `
  <div class="section">
    <h2>Best Posting Times</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>Day</th>
          <th>Hour</th>
          <th class="number">Posts</th>
          <th class="number">Avg Engagement</th>
        </tr>
      </thead>
      <tbody>
        ${data.timing.slice(0, 10).map(t => `
          <tr>
            <td>${dayNames[t.dayOfWeek]}</td>
            <td>${t.hour > 12 ? `${t.hour - 12}PM` : t.hour === 12 ? '12PM' : `${t.hour}AM`}</td>
            <td class="number">${t.postCount}</td>
            <td class="number">${t.avgEngagement}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${data.insights.length > 0 ? `
  <div class="section">
    <h2>AI Insights</h2>
    ${data.insights.map(insight => `
      <div class="insight-card">
        <div class="title">
          ${escapeHtml(insight.title)}
          <span class="confidence-badge confidence-${insight.confidence}">${insight.confidence}</span>
        </div>
        <div class="description">${escapeHtml(insight.description)}</div>
        <div class="data-points">${insight.dataPoints.map(dp => escapeHtml(dp)).join(' | ')}</div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div class="footer">
    Report generated automatically. Data reflects the selected time period.
  </div>
</body>
</html>
  `.trim();
}

export async function exportDashboardToPDF(
  data: DashboardAnalytics,
  organizationName: string,
  timeRangeLabel: string
): Promise<void> {
  const html = generateDashboardHTML(data, organizationName, timeRangeLabel);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Unable to open print window. Please allow popups for this site.');
  }

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

export async function exportContentAIToPDF(
  data: ContentAIAnalytics,
  organizationName: string,
  timeRangeLabel: string
): Promise<void> {
  const html = generateContentAIHTML(data, organizationName, timeRangeLabel);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Unable to open print window. Please allow popups for this site.');
  }

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

export function downloadHTMLAsFile(
  html: string,
  filename: string
): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateDashboardReportHTML(
  data: DashboardAnalytics,
  organizationName: string,
  timeRangeLabel: string
): string {
  return generateDashboardHTML(data, organizationName, timeRangeLabel);
}

export function generateContentAIReportHTML(
  data: ContentAIAnalytics,
  organizationName: string,
  timeRangeLabel: string
): string {
  return generateContentAIHTML(data, organizationName, timeRangeLabel);
}
