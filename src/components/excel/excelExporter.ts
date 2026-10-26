// =====================================================================
// Excel Exporter for Invoice Builder
// Generates UTF-8 encoded .xls spreadsheet with styles, colors, and formulas
// =====================================================================

export interface ExportInvoiceData {
  companyName: string
  companySubtitle: string
  invoiceNumberLabel?: string
  invoiceNumber: string
  invoiceDateLabel?: string
  invoiceDate: string
  taxNumberLabel?: string
  taxNumber?: string
  showTaxNumber?: boolean
  clientHeaderLabel?: string
  clientName: string
  clientPhoneLabel?: string
  clientPhone?: string
  clientAddressLabel?: string
  clientAddress?: string
  customClientFields?: Array<{ label: string; value: string }>
  currencySymbol: string
  columns: Array<{ id: string; header: string; align?: string }>
  rows: Array<{
    cells: Record<
      string,
      {
        value: string
        colSpan?: number
        mergedInto?: any
        style?: { bgColor?: string; textColor?: string; bold?: boolean }
      }
    >
  }>
  showSubtotal?: boolean
  subtotalLabel?: string
  subtotal: number
  discount: number
  showDiscount?: boolean
  discountLabel?: string
  tax: number
  showTax?: boolean
  taxLabel?: string
  customSummaryItems?: Array<{ label: string; amount: number; type: 'add' | 'subtract' }>
  grandTotalLabel?: string
  grandTotal: number
  showClient?: boolean
  showNotes?: boolean
  notesTitle?: string
  notes?: string
  showTerms?: boolean
  termsTitle?: string
  terms?: string
}

/**
 * Trigger download of blob file in browser
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export invoice as formatted .xls (Excel HTML format with styles and colors)
 */
export function exportInvoiceToExcel(data: ExportInvoiceData, filename = 'فاتورة.xls') {
  const tableRowsHtml = data.rows
    .map((row, rIdx) => {
      const cellsHtml = data.columns
        .map((col) => {
          const cell = row.cells[col.id]
          if (cell?.mergedInto) return ''
          const val = cell?.value || ''
          const bg = cell?.style?.bgColor
            ? `background-color: ${cell.style.bgColor};`
            : rIdx % 2 === 1
            ? 'background-color: #f9fafb;'
            : 'background-color: #ffffff;'
          const color = cell?.style?.textColor ? `color: ${cell.style.textColor};` : 'color: #111827;'
          const bold = cell?.style?.bold ? 'font-weight: bold;' : ''
          const align = col.align || 'center'
          const spanAttr = cell?.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : ''
          return `<td${spanAttr} style="padding: 8px 12px; border: 1px solid #d1d5db; text-align: ${align}; ${bg} ${color} ${bold}">${val}</td>`
        })
        .join('')
      return `<tr>${cellsHtml}</tr>`
    })
    .join('')

  const headersHtml = data.columns
    .map((col) => {
      const align = col.align || 'center'
      return `<th style="padding: 10px 12px; background-color: #1e293b; color: #ffffff; border: 1px solid #475569; font-weight: bold; text-align: ${align};">${col.header}</th>`
    })
    .join('')

  const colSpan = Math.max(data.columns.length, 3)

  // Meta rows
  const invNumLabel = data.invoiceNumberLabel || 'رقم الفاتورة'
  const invDateLabel = data.invoiceDateLabel || 'تاريخ الإصدار'
  const taxLabel = data.taxNumberLabel || 'الرقم الضريبي'

  const htmlContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>فاتورة</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
            <x:RTL>1</x:RTL>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
    table { border-collapse: collapse; width: 100%; }
    th, td { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 13px; }
  </style>
</head>
<body dir="rtl">
  <table style="width: 100%; border: none;">
    <!-- Company Header Row -->
    <tr>
      <td colspan="${colSpan}" style="padding: 16px 8px; font-size: 20px; font-weight: bold; color: #0f172a; border-bottom: 2px solid #0284c7;">
        ${data.companyName}
        <div style="font-size: 12px; color: #64748b; font-weight: normal; margin-top: 4px;">${data.companySubtitle}</div>
      </td>
    </tr>
    <tr><td colspan="${colSpan}" style="height: 12px;"></td></tr>

    <!-- Invoice & Client Meta Rows -->
    <tr>
      <td colspan="${data.showClient !== false ? Math.ceil(colSpan / 2) : colSpan}" style="padding: 6px; font-size: 13px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
        <b>${invNumLabel}:</b> ${data.invoiceNumber}<br/>
        <b>${invDateLabel}:</b> ${data.invoiceDate}<br/>
        ${data.showTaxNumber !== false && data.taxNumber ? `<b>${taxLabel}:</b> ${data.taxNumber}<br/>` : ''}
      </td>
      ${
        data.showClient !== false
          ? `
      <td colspan="${Math.floor(colSpan / 2)}" style="padding: 6px; font-size: 13px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
        <b>${data.clientHeaderLabel || 'العميل / الجهة'}:</b> ${data.clientName || 'عميل نقدي'}<br/>
        ${data.clientPhone ? `<b>${data.clientPhoneLabel || 'الهاتف'}:</b> ${data.clientPhone}<br/>` : ''}
        ${data.clientAddress ? `<b>${data.clientAddressLabel || 'العنوان'}:</b> ${data.clientAddress}<br/>` : ''}
        ${
          data.customClientFields
            ? data.customClientFields.map((f) => `<b>${f.label}:</b> ${f.value}<br/>`).join('')
            : ''
        }
      </td>`
          : ''
      }
    </tr>
    <tr><td colspan="${colSpan}" style="height: 16px;"></td></tr>

    <!-- Main Table Header -->
    <thead>
      <tr>${headersHtml}</tr>
    </thead>

    <!-- Main Table Rows -->
    <tbody>
      ${tableRowsHtml}
    </tbody>

    <!-- Totals Summary Rows -->
    <tr><td colspan="${colSpan}" style="height: 10px;"></td></tr>
    ${
      data.showSubtotal !== false
        ? `
    <tr>
      <td colspan="${Math.max(colSpan - 2, 1)}" style="border: none;"></td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: bold; text-align: right;">${
        data.subtotalLabel || 'المجموع الفرعي'
      }:</td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; background-color: #f1f5f9; font-weight: bold; text-align: left;">${data.subtotal.toFixed(
        2
      )} ${data.currencySymbol}</td>
    </tr>`
        : ''
    }
    ${
      data.showDiscount !== false && data.discount > 0
        ? `
    <tr>
      <td colspan="${Math.max(colSpan - 2, 1)}" style="border: none;"></td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; background-color: #fff1f2; color: #be123c; font-weight: bold; text-align: right;">${
        data.discountLabel || 'الخصم الممنوح'
      }:</td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; background-color: #fff1f2; color: #be123c; font-weight: bold; text-align: left;">-${data.discount.toFixed(
        2
      )} ${data.currencySymbol}</td>
    </tr>`
        : ''
    }
    ${
      data.showTax !== false && data.tax > 0
        ? `
    <tr>
      <td colspan="${Math.max(colSpan - 2, 1)}" style="border: none;"></td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; background-color: #f0fdf4; color: #15803d; font-weight: bold; text-align: right;">${
        data.taxLabel || 'الضريبة المضافة'
      }:</td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; background-color: #f0fdf4; color: #15803d; font-weight: bold; text-align: left;">+${data.tax.toFixed(
        2
      )} ${data.currencySymbol}</td>
    </tr>`
        : ''
    }
    ${
      data.customSummaryItems
        ? data.customSummaryItems
            .map(
              (item) => `
    <tr>
      <td colspan="${Math.max(colSpan - 2, 1)}" style="border: none;"></td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; background-color: #f8fafc; font-weight: bold; text-align: right;">${
        item.label
      }:</td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; background-color: #f8fafc; font-weight: bold; text-align: left;">${
        item.type === 'subtract' ? '-' : '+'
      }${Number(item.amount).toFixed(2)} ${data.currencySymbol}</td>
    </tr>`
            )
            .join('')
        : ''
    }
    <tr>
      <td colspan="${Math.max(colSpan - 2, 1)}" style="border: none;"></td>
      <td style="padding: 10px; border: 2px solid #0284c7; background-color: #0284c7; color: #ffffff; font-weight: bold; font-size: 15px; text-align: right;">${
        data.grandTotalLabel || 'المبلغ الإجمالي النهائي'
      }:</td>
      <td style="padding: 10px; border: 2px solid #0284c7; background-color: #0284c7; color: #ffffff; font-weight: bold; font-size: 15px; text-align: left;">${data.grandTotal.toFixed(
        2
      )} ${data.currencySymbol}</td>
    </tr>

    <!-- Notes & Terms -->
    ${
      data.showNotes !== false && data.notes
        ? `
    <tr><td colspan="${colSpan}" style="height: 14px;"></td></tr>
    <tr>
      <td colspan="${colSpan}" style="padding: 10px; background-color: #f8fafc; border: 1px dashed #cbd5e1; font-size: 12px; color: #475569;">
        <b>${data.notesTitle || 'ملاحظات وشروط الدفع'}:</b> ${data.notes}
      </td>
    </tr>`
        : ''
    }
    ${
      data.showTerms !== false && data.terms
        ? `
    <tr>
      <td colspan="${colSpan}" style="padding: 10px; background-color: #f8fafc; border: 1px dashed #cbd5e1; font-size: 12px; color: #475569;">
        <b>${data.termsTitle || 'شروط الاسترجاع والضمان'}:</b> ${data.terms}
      </td>
    </tr>`
        : ''
    }
  </table>
</body>
</html>
`

  downloadFile(
    '\ufeff' + htmlContent,
    filename.endsWith('.xls') ? filename : `${filename}.xls`,
    'application/vnd.ms-excel;charset=utf-8'
  )
}

/**
 * Export invoice as CSV
 */
export function exportInvoiceToCsv(data: ExportInvoiceData, filename = 'فاتورة.csv') {
  const escape = (val: any) => {
    const str = String(val ?? '')
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines: string[] = []
  lines.push([escape(data.companyName), escape(data.companySubtitle)].join(','))
  lines.push([
    escape(`${data.invoiceNumberLabel || 'رقم الفاتورة'}: ${data.invoiceNumber}`),
    escape(`${data.invoiceDateLabel || 'التاريخ'}: ${data.invoiceDate}`),
  ].join(','))

  if (data.showClient !== false && data.clientName) {
    lines.push([escape(`${data.clientHeaderLabel || 'العميل'}: ${data.clientName}`)].join(','))
  }
  lines.push('') // empty row

  // Table headers
  lines.push(data.columns.map((c) => escape(c.header)).join(','))

  // Table data rows
  for (const row of data.rows) {
    const rowVals = data.columns.map((col) => escape(row.cells[col.id]?.value || ''))
    lines.push(rowVals.join(','))
  }

  lines.push('')
  if (data.showSubtotal !== false) {
    lines.push([
      escape(data.subtotalLabel || 'المجموع الفرعي'),
      escape(`${data.subtotal.toFixed(2)} ${data.currencySymbol}`),
    ].join(','))
  }
  if (data.showDiscount !== false && data.discount > 0) {
    lines.push([
      escape(data.discountLabel || 'الخصم الممنوح'),
      escape(`-${data.discount.toFixed(2)} ${data.currencySymbol}`),
    ].join(','))
  }
  if (data.showTax !== false && data.tax > 0) {
    lines.push([
      escape(data.taxLabel || 'الضريبة المضافة'),
      escape(`+${data.tax.toFixed(2)} ${data.currencySymbol}`),
    ].join(','))
  }
  if (data.customSummaryItems) {
    data.customSummaryItems.forEach((item) => {
      lines.push([
        escape(item.label),
        escape(`${item.type === 'subtract' ? '-' : '+'}${Number(item.amount).toFixed(2)} ${data.currencySymbol}`),
      ].join(','))
    })
  }
  lines.push([
    escape(data.grandTotalLabel || 'المبلغ الإجمالي النهائي'),
    escape(`${data.grandTotal.toFixed(2)} ${data.currencySymbol}`),
  ].join(','))

  if (data.showNotes !== false && data.notes) {
    lines.push([escape(`${data.notesTitle || 'ملاحظات وشروط الدفع'}:`), escape(data.notes)].join(','))
  }
  if (data.showTerms !== false && data.terms) {
    lines.push([escape(`${data.termsTitle || 'شروط الاسترجاع والضمان'}:`), escape(data.terms)].join(','))
  }

  downloadFile(
    '\ufeff' + lines.join('\r\n'),
    filename.endsWith('.csv') ? filename : `${filename}.csv`,
    'text/csv;charset=utf-8'
  )
}
