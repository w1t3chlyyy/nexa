import { jsPDF } from 'jspdf';
import { PdfReceiptData } from '../types';

export function createPdfReceiptData(
  orderNumber: string,
  fiatAmount: number,
  cryptoAmount: number,
  cryptoSymbol: any,
  rateUsed: number,
  recipientBank: string,
  recipientAccount: string,
  recipientName: string,
  adminUsername: string = 'crypto_admin'
): PdfReceiptData {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase();
  const opId = `SBP-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${randomHex}`;
  const sbpRef = `A${Math.floor(100000000000 + Math.random() * 900000000000)}`;

  return {
    id: `receipt_${Date.now()}`,
    operationId: opId,
    orderNumber,
    date: `${dateStr} ${timeStr}`,
    senderBank: 'АО «ТБанк» / Шлюз СБП CryptoNexa',
    recipientBank,
    recipientAccount,
    recipientName,
    fiatAmount,
    cryptoAmount,
    cryptoSymbol,
    rateUsed,
    status: 'EXECUTED',
    executedAt: `${dateStr} ${timeStr}`,
    operatorName: `@${adminUsername}`,
    sbpTransactionRef: sbpRef,
  };
}

export function generateSbpReceiptPdf(data: PdfReceiptData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Background clean container
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');

  // Header band (Bank & SBP banner)
  doc.setFillColor(24, 24, 27); // dark zinc
  doc.roundedRect(15, 15, 180, 26, 3, 3, 'F');

  doc.setTextColor(163, 255, 18); // #A3FF12 lime
  doc.setFontSize(16);
  doc.text('СБП', 25, 28);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('Квитанция о переводе через СБП', 45, 26);
  
  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text('Система Быстрых Платежей Банка России • Мгновенное зачисление 0%', 45, 33);

  // Status Badge
  doc.setFillColor(235, 254, 210);
  doc.roundedRect(145, 22, 42, 12, 2, 2, 'F');
  doc.setTextColor(45, 100, 20);
  doc.setFontSize(9);
  doc.text('ИСПОЛНЕНО', 151, 30);

  // Main Amount Box
  doc.setFillColor(244, 244, 245);
  doc.roundedRect(15, 48, 180, 32, 3, 3, 'F');

  doc.setFontSize(9);
  doc.setTextColor(113, 113, 122);
  doc.text('Сумма перевода:', 25, 58);

  doc.setFontSize(20);
  doc.setTextColor(9, 9, 11);
  const formattedRub = data.fiatAmount.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  doc.text(`${formattedRub} RUB`, 25, 71);

  doc.setFontSize(9);
  doc.setTextColor(82, 82, 91);
  doc.text(`Комиссия: 0.00 RUB (0%)`, 130, 58);
  doc.text(`Списано: ${data.cryptoAmount} ${data.cryptoSymbol}`, 130, 66);
  doc.text(`Курс: 1 ${data.cryptoSymbol} = ${data.rateUsed.toFixed(2)} ₽`, 130, 74);

  // Details Table Box
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, 88, 180, 100, 3, 3);

  doc.setFontSize(11);
  doc.setTextColor(24, 24, 27);
  doc.text('Реквизиты операции', 25, 98);

  // Lines
  const rows = [
    { label: 'Номер ордера / заявки:', val: data.orderNumber },
    { label: 'Номер операции СБП (ID):', val: data.operationId },
    { label: 'Референс транзакции НСПК:', val: data.sbpTransactionRef },
    { label: 'Дата и время перевода:', val: data.executedAt },
    { label: 'Банк отправителя:', val: data.senderBank },
    { label: 'Банк получателя:', val: data.recipientBank },
    { label: 'Счет / Телефон получателя:', val: data.recipientAccount },
    { label: 'Получатель:', val: data.recipientName },
    { label: 'Оператор сервиса:', val: data.operatorName },
  ];

  let yPos = 108;
  rows.forEach((r, idx) => {
    doc.setFontSize(8.5);
    doc.setTextColor(113, 113, 122);
    doc.text(r.label, 25, yPos);

    doc.setTextColor(24, 24, 27);
    doc.setFontSize(8.5);
    doc.text(r.val, 95, yPos);

    if (idx < rows.length - 1) {
      doc.setDrawColor(244, 244, 245);
      doc.line(25, yPos + 2.5, 185, yPos + 2.5);
    }
    yPos += 8.5;
  });

  // Stamp / Bank Seal Box
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.6);
  doc.roundedRect(25, 200, 85, 45, 2, 2);

  doc.setTextColor(37, 99, 235);
  doc.setFontSize(8);
  doc.text('АО «ТБанк» • ПЛАТЕЖНЫЙ ШЛЮЗ СБП', 28, 208);
  doc.setFontSize(9);
  doc.text('ОПЕРАЦИЯ ИСПОЛНЕНА', 28, 216);
  doc.setFontSize(7.5);
  doc.text(`Дата: ${data.executedAt}`, 28, 223);
  doc.text(`ID: ${data.operationId}`, 28, 229);
  doc.text('Штамп электронной подписи', 28, 235);
  doc.text('ПАО «Центральный Банк РФ / НСПК»', 28, 241);

  // Security Note
  doc.setTextColor(113, 113, 122);
  doc.setFontSize(7.5);
  doc.text('Документ сформирован автоматически в платежном модуле CryptoCheque Pay.', 118, 206);
  doc.text('Подлинность подтверждена шлюзом СБП Банка России.', 118, 212);
  doc.text('Чек имеет юридическую силу электронного платежного документа.', 118, 218);
  doc.text(`Номер заявки: ${data.orderNumber}`, 118, 226);

  // Footer
  doc.setDrawColor(228, 228, 231);
  doc.line(15, 260, 195, 260);

  doc.setFontSize(7);
  doc.setTextColor(161, 161, 170);
  doc.text('CryptoCheque Pay v2.4 Live • Автоматизированный сервис мгновенного выкупа чеков CryptoBot по СБП', 15, 268);
  doc.text(`Сформировано: ${new Date().toISOString()} • Страница 1 из 1`, 15, 274);

  return doc;
}

export function downloadSbpReceiptPdf(data: PdfReceiptData, filename?: string) {
  const doc = generateSbpReceiptPdf(data);
  const safeName = filename || `SBP_Cheque_${data.orderNumber}_${Date.now()}.pdf`;
  doc.save(safeName);
}
