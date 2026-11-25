import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { db } from '@/lib/db';
import { getAdmin, can } from '@/lib/auth';
import { logActivity } from '@/lib/notify';
const safe = (v: any) => { const s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) ? "'" + s : s; };   // blocks spreadsheet formula injection
const csv = (rows: any[][]) => rows.map(r => r.map(c => `"${safe(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
export async function GET(req: Request) {
  const a = await getAdmin();
  if (!a) return new NextResponse('Unauthorised', { status: 401 });
  const u = new URL(req.url).searchParams, type = u.get('type'), fmt = u.get('format') || 'csv';
  const from = u.get('from') || '1970-01-01', to = (u.get('to') || '2999-01-01') + 'T23:59:59Z';
  if (type === 'orders' && !can(a, 'export_orders')) return new NextResponse('No permission', { status: 403 });
  if (type !== 'orders' && a.role !== 'super') return new NextResponse('Super Admin only', { status: 403 });
  let head: string[] = [], rows: any[][] = [];
  if (type === 'orders') {
    const { data } = await db.from('orders').select('order_number,created_at,channel,pack_qty,total_kobo,payment_status,order_status,city,state,customers(full_name,phone_e164)').gte('created_at', from).lte('created_at', to).order('created_at');
    head = ['Order', 'Placed (UTC)', 'Channel', 'Qty', ...(a.role === 'super' ? ['Total NGN', 'Payment'] : []), 'Status', 'City', 'State', 'Customer', 'Phone'];
    rows = (data || []).map((o: any) => [o.order_number, o.created_at, o.channel, o.pack_qty, ...(a.role === 'super' ? [o.total_kobo / 100, o.payment_status] : []), o.order_status, o.city, o.state, o.customers?.full_name, o.customers?.phone_e164]);
  } else if (type === 'customers') {
    const { data } = await db.from('customers').select('full_name,phone_e164,email,city,state,marketing_consent,consent_at,created_at').gte('created_at', from).lte('created_at', to).order('created_at');
    head = ['Name', 'Phone', 'Email', 'City', 'State', 'Marketing consent', 'Consent date', 'First seen']; rows = (data || []).map((c: any) => [c.full_name, c.phone_e164, c.email, c.city, c.state, c.marketing_consent ? 'yes' : 'no', c.consent_at, c.created_at]);
  } else if (type === 'payments') {
    const { data } = await db.from('payments').select('reference,provider,amount_kobo,fees_kobo,status,channel,paid_at,orders(order_number)').gte('created_at', from).lte('created_at', to).order('created_at');
    head = ['Reference', 'Order', 'Provider', 'Amount NGN', 'Fee NGN', 'Status', 'Channel', 'Paid (UTC)']; rows = (data || []).map((p: any) => [p.reference, p.orders?.order_number, p.provider, p.amount_kobo / 100, p.fees_kobo == null ? '' : p.fees_kobo / 100, p.status, p.channel, p.paid_at]);
  } else return new NextResponse('Unknown export', { status: 400 });
  await logActivity(a.id, 'export', type!, '', fmt);
  const name = `loft-${type}`;
  if (fmt === 'xlsx') {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet(String(type));
    ws.addRow(head).font = { bold: true }; rows.forEach(r => ws.addRow(r.map(safe)));
    ws.columns.forEach(c => { c.width = 20; });
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buf as ArrayBuffer), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}.xlsx"` } });
  }
  if (fmt === 'pdf') {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 }), chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    const done = new Promise<void>(r => doc.on('end', () => r()));
    const w = (doc.page.width - 56) / head.length;
    const line = (cells: any[], bold: boolean) => { const y = doc.y; doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7); cells.forEach((c, i) => doc.text(safe(c), 28 + i * w, y, { width: w - 4, height: 10, ellipsis: true, lineBreak: false })); doc.y = y + 13; };
    doc.font('Helvetica-Bold').fontSize(13).text(`LOFT ${type} (${from === '1970-01-01' ? 'all' : from} to ${u.get('to') || 'now'})`); doc.moveDown(0.5);
    line(head, true); rows.forEach(r => { if (doc.y > doc.page.height - 50) { doc.addPage(); line(head, true); } line(r, false); });
    doc.end(); await done;
    return new NextResponse(new Uint8Array(Buffer.concat(chunks)), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}.pdf"` } });
  }
  return new NextResponse('\uFEFF' + csv([head, ...rows]), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"` } });
}
