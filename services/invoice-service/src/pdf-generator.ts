import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ReceiptData {
  transactionRef: string;
  payerUserId: string;
  payeeUserId?: string | null;
  payerEmail: string;
  payeeEmail?: string | null;
  amount: number;
  currency: string;
  description: string;
  createdAt?: Date;
}

const RECEIPTS_DIR = path.join(__dirname, '..', 'receipts');

// Ensure the receipts directory exists
if (!fs.existsSync(RECEIPTS_DIR)) {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

/**
 * Generates a beautiful PDF receipt for a bank transaction.
 * Replaces the old receipt-less "instant pay" flow with actual bank receipts.
 */
export function generateReceiptPdf(data: ReceiptData): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A6' }); // Elegant small card format (A6)
      const fileName = `Receipt_${data.transactionRef}.pdf`;
      const filePath = path.join(RECEIPTS_DIR, fileName);
      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // --- BRANDING & HEADER ---
      doc.rect(0, 0, doc.page.width, 15).fill('#0f172a'); // Premium Dark Blue Slate Top Glow

      doc.fillColor('#0f172a')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('FinVault', 30, 30);

      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#64748b')
         .text('Official Bank Transaction Receipt', 30, 48);

      // Status Badge
      doc.rect(doc.page.width - 90, 30, 60, 18).fill('#10b981'); // Premium Green
      doc.fillColor('#ffffff')
         .fontSize(7)
         .font('Helvetica-Bold')
         .text('SUCCESS', doc.page.width - 90, 35, { width: 60, align: 'center' });

      doc.moveDown(2);

      // --- TRANSACTION SUMMARY ---
      doc.fillColor('#0f172a');
      doc.fontSize(22)
         .font('Helvetica-Bold')
         .text(`${data.amount.toFixed(2)} ${data.currency || 'EUR'}`, 30, 75);

      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#64748b')
         .text(`Amount Processed`, 30, 98);

      // Divider Line
      doc.moveTo(30, 115)
         .lineTo(doc.page.width - 30, 115)
         .strokeColor('#e2e8f0')
         .lineWidth(1)
         .stroke();

      // --- TRANSACTION DETAILS ---
      let currentY = 130;
      const drawDetailRow = (label: string, value: string) => {
        doc.fontSize(7)
           .font('Helvetica-Bold')
           .fillColor('#475569')
           .text(label, 30, currentY);
        
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#0f172a')
           .text(value, doc.page.width - 180, currentY, { width: 150, align: 'right' });
        
        currentY += 18;
      };

      const dateStr = (data.createdAt ? new Date(data.createdAt) : new Date()).toLocaleString('nl-NL', {
        timeZone: 'Europe/Amsterdam',
        hour12: false
      });

      drawDetailRow('Reference', data.transactionRef);
      drawDetailRow('Date & Time', dateStr);
      drawDetailRow('Payer Account', data.payerEmail);
      drawDetailRow('Payee Account', data.payeeEmail || 'External Deposit');
      drawDetailRow('Description', data.description || 'N/A');

      // --- INTEGRITY & SECURITY ---
      // Generate HMAC-SHA256 integrity hash of the transaction to sign the receipt
      const secret = process.env.HMAC_SECRET || 'finvault-integrity-secret-key-102938';
      const hashInput = `${data.transactionRef}|${data.amount}|${data.payerEmail}|${data.payeeEmail || ''}`;
      const integrityHash = crypto.createHmac('sha256', secret).update(hashInput).digest('hex').substring(0, 16);

      // Security footer glow
      doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill('#f8fafc');

      doc.fillColor('#64748b')
         .fontSize(6)
         .font('Helvetica')
         .text(`Digital Security Signature: ${integrityHash.toUpperCase()}`, 30, doc.page.height - 25);

      doc.fontSize(5)
         .text('FinVault transactions are crytographically signed and legally binding.', 30, doc.page.height - 15);

      doc.end();

      writeStream.on('finish', () => {
        resolve(filePath);
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}
