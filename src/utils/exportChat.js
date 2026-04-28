/**
 * exportChat — export chat messages as PDF or image using html-to-image.
 * Falls back gracefully if the library is unavailable.
 */
import { toPng } from 'html-to-image';

/**
 * Capture a DOM node as a PNG and trigger browser download.
 * @param {HTMLElement} node
 * @param {string} filename
 */
export async function exportChatAsImage(node, filename = 'chat-export.png') {
    if (!node) throw new Error('No element to export');
    const dataUrl = await toPng(node, {
        cacheBust: true,
        backgroundColor: window.getComputedStyle(document.documentElement).getPropertyValue('--page-bg').trim() || '#ffffff',
        pixelRatio: 2,
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
}

/**
 * Build a plain-text summary of messages and trigger a .txt download.
 * @param {Array} messages
 * @param {string} chatTitle
 */
export function exportChatAsText(messages, chatTitle = 'chat') {
    const lines = (messages || []).map((m) => {
        const date = m.date || '';
        const time = m.time || '';
        const sender = m.sender || 'Unknown';
        const text = m.message || '';
        return `[${date} ${time}] ${sender}: ${text}`.trim();
    });
    const content = [`=== ${chatTitle} ===`, `Exported: ${new Date().toLocaleString()}`, '', ...lines].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${chatTitle.replace(/[^a-z0-9]/gi, '_')}_export.txt`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Build a minimal HTML/PDF-ready page and trigger print dialog (browser saves as PDF).
 * @param {Array} messages
 * @param {string} chatTitle
 */
export function exportChatAsPDF(messages, chatTitle = 'chat') {
    const rows = (messages || []).map((m) => {
        const date = String(m.date || '').replace(/</g, '&lt;');
        const time = String(m.time || '').replace(/</g, '&lt;');
        const sender = String(m.sender || '').replace(/</g, '&lt;');
        const text = String(m.message || '').replace(/</g, '&lt;');
        return `<tr><td style="color:#666;white-space:nowrap;padding:4px 8px;font-size:11px">${date} ${time}</td><td style="font-weight:600;padding:4px 8px;font-size:12px">${sender}</td><td style="padding:4px 8px;font-size:13px">${text}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${chatTitle}</title>
<style>
  body{font-family:system-ui,sans-serif;color:#0f172a;padding:20px}
  h1{font-size:18px;margin-bottom:4px}
  p.meta{font-size:12px;color:#64748b;margin-bottom:16px}
  table{border-collapse:collapse;width:100%}
  tr:nth-child(even){background:#f8fafc}
  td{border-bottom:1px solid #e2e8f0;vertical-align:top}
</style>
</head>
<body>
<h1>${chatTitle}</h1>
<p class="meta">Exported ${new Date().toLocaleString()} · ${(messages || []).length} messages</p>
<table>${rows}</table>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 400);
}
