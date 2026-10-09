import {productLabel} from './gametim-shipping.mjs';
// Builds a printable shipping plan. No inventory changes are made by exporting.
export function createShippingPdf(JsPDF, shipment) {
  const doc = new JsPDF({ unit: 'mm', format: 'letter' });
  const { plan, lines = [] } = shipment;
  const clean = value => String(value ?? '').replace(/[^\x20-\x7e]/g, ' ').trim();
  const width = doc.internal.pageSize.getWidth();
  let y = 15;
  const heading = () => {
    doc.setFont('helvetica', 'bold');doc.setFontSize(18);
    doc.text('GAMETIME SHIPPING', 14, y);y += 8;
    doc.setFontSize(11);doc.setFont('helvetica', 'normal');
    for (const text of [
      'Packing slip: ' + clean(shipment.number || 'Draft') + '    Status: ' + clean(shipment.status),
      'Customer: ' + clean(shipment.customer) + '    PO: ' + clean(shipment.po),
      'Pallets: ' + (plan.totals?.pallets ?? 0) + '    Gross weight: ' + (plan.totals?.grossLb ?? 0) + ' lb'
    ]) {
      const wrapped = doc.splitTextToSize(text, width - 28);
      doc.text(wrapped, 14, y);y += wrapped.length * 5 + 2;
    }
  };
  heading();
  const batches = (item) => [...new Set(lines.filter(l =>
    l.sku === item.sku && productLabel(l.sku || '',l.description || '',l.size || '') === item.product
  ).map(l => l.batch).filter(Boolean))].join(', ');
  const table = (title, rows) => {
    if (y > 225) {doc.addPage();y = 15;}
    doc.setFont('helvetica', 'bold');doc.setFontSize(14);doc.text(title, 14, y);y += 4;
    doc.autoTable({
      startY: y, margin: {left: 14, right: 14, top: 15, bottom: 16},
      head: [['Product / SKU / Batch', 'Package', 'Units', 'Boxes', 'Position']],
      body: rows,
      theme: 'grid', styles: {fontSize: 10, cellPadding: 3, textColor: 0, lineColor: 80, lineWidth: 0.2, overflow: 'linebreak'},
      headStyles: {fillColor: 235, textColor: 0, fontStyle: 'bold'},
      columnStyles: {0: {cellWidth: 79}, 1: {cellWidth: 30}, 2: {halign: 'right'}, 3: {halign: 'right'}, 4: {cellWidth: 25}},
      rowPageBreak: 'avoid'
    });
    y = doc.lastAutoTable.finalY + 10;
  };
  for (const pallet of plan.pallets || []) {
    table('PALLET ' + pallet.number + ' - ' + clean(pallet.kind).toUpperCase() + ' - ' + (pallet.pounds || 0) + ' lb',
      (pallet.items || []).map(item => [
        clean(item.product) + (item.sku ? '\nSKU: ' + clean(item.sku) : '') + (batches(item) ? '\nBatch: ' + clean(batches(item)) : ''),
        clean(item.size), String(item.units ?? 0), item.boxes == null ? '-' : String(item.boxes), item.onTop ? 'ON TOP' : 'BASE'
      ]));
  }
  const mail = lines.filter(l => l.size === 'drawdown');
  if (mail.length) table('DRAWDOWNS / MAIL - NOT ON PALLETS', mail.map(l => [clean(l.description), 'Drawdown', String(l.qty), '-', 'MAIL']));
  if (shipment.notes) {
    const notes = doc.splitTextToSize('Notes: ' + clean(shipment.notes), width - 28);
    for (const line of notes) {
      if (y > 245) {doc.addPage();y = 15;}
      doc.setFont('helvetica', 'normal');doc.setFontSize(11);doc.text(line, 14, y);y += 5;
    }
  }
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);doc.setFontSize(9);doc.setFont('helvetica', 'normal');
    doc.text('Packing slip ' + clean(shipment.number || 'Draft') + ' | Page ' + i + ' of ' + pages, 14, 266);
  }
  return doc;
}
