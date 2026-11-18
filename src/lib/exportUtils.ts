import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any, row: any) => string;
}

export interface ExportFilter {
  key: string;
  label: string;
  type: 'select' | 'dateRange';
  options?: { value: string; label: string }[];
}

// CSV Export
export const exportToCSV = (
  data: Record<string, any>[],
  columns: ExportColumn[],
  filename: string
) => {
  const headers = columns.map(col => col.label);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      return col.format ? col.format(value, row) : (value ?? '');
    })
  );

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
};

// Excel Export (uses ExcelJS — replaces vulnerable xlsx/sheetjs package)
export const exportToExcel = async (
  data: Record<string, any>[],
  columns: ExportColumn[],
  filename: string
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Export');

  worksheet.columns = columns.map(col => ({
    header: col.label,
    key: col.key,
    width: Math.min(Math.max(col.label.length + 2, 12), 50),
  }));

  data.forEach(row => {
    const rowData: Record<string, any> = {};
    columns.forEach(col => {
      const value = row[col.key];
      rowData[col.key] = col.format ? col.format(value, row) : (value ?? '');
    });
    worksheet.addRow(rowData);
  });

  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `${filename}.xlsx`);
};

// PDF Export
export const exportToPDF = (
  data: Record<string, any>[],
  columns: ExportColumn[],
  filename: string,
  title: string
) => {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(16);
  doc.text(title, 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Exported on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 14, 22);
  doc.setTextColor(0);

  const headers = columns.map(col => col.label);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      return col.format ? col.format(value, row) : (value ?? '');
    })
  );

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { top: 28 },
  });

  doc.save(`${filename}.pdf`);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const generateFilename = (baseName: string) => {
  const timestamp = format(new Date(), 'yyyy-MM-dd');
  return `${baseName}-${timestamp}`;
};
