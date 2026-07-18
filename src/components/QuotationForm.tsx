import React, { useState, useEffect } from 'react';
import { CompanyInfo, Client, Quotation, QuotationRow, InternalRow } from '../types';
import { Plus, Save, FileText, Eye, EyeOff, Download, FolderOpen, HelpCircle, X, User, Zap, Brain, MessageSquare, Notebook, Trash2, Bold, List, Paperclip, Loader2, FileUp, HardDrive, Copy, Check, ExternalLink, Settings } from 'lucide-react';
import { getCompanyProfile, saveQuotation, getQuotations, updateQuotation, getClients, addClient, getAttachments, uploadAttachment, downloadAttachment, deleteAttachment } from '../lib/db';
import { connectNasFolder, getFileFromNas, getNasFolderHandle } from '../lib/nasBridge';
import QuillEditor from './QuillEditor';
import ClientSelectorPopup from './ClientSelectorPopup';
import PDFPreviewModal from './PDFPreviewModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Simulator from './Simulator';

const PDF_STYLES = `
    * { font-family: Helvetica !important; }
    strong, b { font-weight: bold !important; }
    em, i { font-style: italic !important; }
    .ql-align-center { text-align: center !important; }
    .ql-align-right { text-align: right !important; }
    .ql-align-justify { text-align: justify !important; }
    .ql-align-left { text-align: left !important; }
    .ql-color-red, span[style*="color: rgb(230, 0, 0)"], span[style*="color: #e60000"], span[style*="color: red"] { color: red !important; }
`;

const cleanHtmlText = (html: string) => {
    if (!html) return '';
    let text = html
        .replace(/<\/p>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li>/gi, '• ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '');
    return text.trim();
};

export const isNasLinkPath = (path: string | null): boolean => {
  if (!path) return false;
  return path.startsWith('\\\\') || path.startsWith('smb://') || /^[a-zA-Z]:\\/.test(path) || path.startsWith('nas://');
};

export const getFileNameFromPath = (path: string | null): string => {
  if (!path) return '';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
};

export default function QuotationForm(props: { onSave?: () => void, editingQuotation?: Quotation }) {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: '', address: '', cap: '', city: '', phone: '', email: '', vatNumber: '', sdiCode: '', pec: '' });
  const [clientInfo, setClientInfo] = useState<Client>({ id: '', name: '', email: '', address: '', phone: '', vatNumber: '', sdiCode: '', cap: '', city: '' });
  const [rows, setRows] = useState<QuotationRow[]>(Array(5).fill(null).map((_, i) => ({ id: i.toString(), description: '', quantity: undefined, price: undefined })));
  const [internalRows, setInternalRows] = useState<InternalRow[]>([]);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [showTotal, setShowTotal] = useState<boolean>(true);
  const [forceQuotationNumber, setForceQuotationNumber] = useState<boolean>(false);
  const [customTotal, setCustomTotal] = useState<number | null>(null);
  
  const [quotationNumber, setQuotationNumber] = useState<string>('1');
  const [quotationYear, setQuotationYear] = useState<number>(new Date().getFullYear());
  const [quotationLetter, setQuotationLetter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'anagrafica' | 'preventivo' | 'noteCliente' | 'noteInterne' | 'allegati'>('anagrafica');
// ...
  const tabs = [
      { id: 'anagrafica', label: 'Anagrafica', icon: <User size={16} /> },
      { id: 'preventivo', label: 'Preventivo', icon: <FileText size={16} /> },
      { id: 'noteCliente', label: 'Note Cliente', icon: <MessageSquare size={16} /> },
      { id: 'noteInterne', label: 'Simulatore', icon: <Zap size={16} /> },
      { id: 'allegati', label: 'Allegati', icon: <FolderOpen size={16} /> },
  ] as const;

  const [attachment, setAttachment] = useState<string | null>(props.editingQuotation?.attachment || null);
  const [attachmentsList, setAttachmentsList] = useState<string[]>(
    props.editingQuotation?.attachmentsList || 
    (props.editingQuotation?.attachment ? [props.editingQuotation.attachment] : [])
  );
  const [isNasLink, setIsNasLink] = useState(isNasLinkPath(props.editingQuotation?.attachment || null));
  const [nasPathInput, setNasPathInput] = useState(isNasLinkPath(props.editingQuotation?.attachment || null) ? props.editingQuotation?.attachment || '' : '');
  const [isUploading, setIsUploading] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [activeViewerPath, setActiveViewerPath] = useState<string | null>(null);
  const [isNasConnected, setIsNasConnected] = useState(false);
  const [nasRootPath, setNasRootPath] = useState(localStorage.getItem('nas_root_path') || '\\\\NAS\\Preventivi\\');

  useEffect(() => {
    getNasFolderHandle().then(handle => {
      setIsNasConnected(!!handle);
    });
  }, []);

  const handleConnectNas = async () => {
    const handle = await connectNasFolder();
    if (handle) {
      setIsNasConnected(true);
      
      // Tentiamo di suggerire un percorso basato sul nome della cartella selezionata
      const folderName = handle.name;
      const suggestion = `\\\\NAS\\${folderName}\\`;
      
      // Aggiorna direttamente la radice senza prompt, come richiesto dall'utente
      localStorage.setItem('nas_root_path', suggestion);
      setNasRootPath(suggestion);
      
      alert(`Cartella NAS "${folderName}" connessa e impostata come radice!`);
    }
  };

  const handleViewNasPdf = async (path: string) => {
    try {
      const file = await getFileFromNas(path);
      if (file) {
        const url = URL.createObjectURL(file);
        setActiveViewerPath(url);
      } else {
        alert("Impossibile trovare il file sul NAS. Verifica che la cartella sia connessa.");
      }
    } catch (err) {
      console.error("Errore visualizzazione PDF:", err);
    }
  };

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [stagedLocalPath, setStagedLocalPath] = useState<string>('');
  const [pathCopiedFeedback, setPathCopiedFeedback] = useState<boolean>(false);

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Support both real mime-type and extension check
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith('.pdf')) {
      alert("Formato non valido. Sono ammessi solo file PDF.");
      return;
    }

    const filename = file.name;
    setSelectedFileName(filename);

    // Format local network path suggestion (using double backslash for SMB/NAS)
    const suggestedPath = `${nasRootPath}${filename}`;
    setStagedLocalPath(suggestedPath);
  };

  const handleConfirmLocalPath = () => {
    if (!stagedLocalPath.trim()) {
      alert("Nessun percorso da confermare. Seleziona prima un file.");
      return;
    }

    const finalPath = stagedLocalPath.trim();
    if (attachmentsList.includes(finalPath)) {
      alert("Questo percorso è già presente nella lista degli allegati.");
      return;
    }

    setAttachmentsList(prev => [...prev, finalPath]);
    setSelectedFileName(null);
    setStagedLocalPath('');

    alert(`Successo!\nIl percorso di rete:\n\n${finalPath}\n\nè stato aggiunto alla lista degli allegati. Ricorda di salvare il preventivo per memorizzarlo stabilmente.`);
  };

  const handleQuotationFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Formato non valido. Sono ammessi solo file PDF.");
      return;
    }

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      setIsUploading(true);
      const response = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setAttachment(result.path);
      } else {
        alert("Errore caricamento: " + result.error);
      }
    } catch (err) {
      console.error("Errore upload:", err);
      alert(`Errore durante l'invio del file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const [quotationDate, setQuotationDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<string>('');
  const [condizioni, setCondizioni] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showPdfSaveModal, setShowPdfSaveModal] = useState(false);
  const [pdfFilename, setPdfFilename] = useState('');
  const [pendingPdfDoc, setPendingPdfDoc] = useState<jsPDF | null>(null);

  const [trasporto, setTrasporto] = useState<'incluso' | 'a carico del cliente' | null>('incluso');
  const [installazione, setInstallazione] = useState<'inclusa' | 'da quantificare' | null>('inclusa');
  const [collaudo, setCollaudo] = useState<'incluso' | 'non incluso' | null>('incluso');
  const [validita, setValidita] = useState<string>('');

  const handleGoToNewClient = () => {
    sessionStorage.setItem('open_new_client_form', 'true');
    window.dispatchEvent(new CustomEvent('go-to-new-client-form'));
  };

  const isRowEmpty = (row: QuotationRow) => {
    if (row.isDescriptionOnly) {
      if (!row.description) return true;
      const cleanText = row.description.replace(/<[^>]+>/g, '').trim();
      return cleanText === '';
    }
    return (
      (!row.description || !row.description.trim()) &&
      (row.quantity === undefined || row.quantity === null || isNaN(row.quantity)) &&
      (row.price === undefined || row.price === null || isNaN(row.price))
    );
  };

  const purgeEmptyRows = () => {
    const cleaned = rows.filter(row => !isRowEmpty(row));
    if (cleaned.length === 0) {
      const defaultRows = [{ id: Date.now().toString(), description: '', quantity: undefined, price: undefined }];
      setRows(defaultRows);
      return defaultRows;
    } else {
      setRows(cleaned);
      return cleaned;
    }
  };

  const deleteRow = (id: string) => {
    setRows(prevRows => prevRows.filter(row => row.id !== id));
  };

  const handleAddInternalRowFromSimulator = (description: string, cost: number) => {
       setInternalRows([...internalRows, {
           id: Date.now().toString(),
           description,
           quantity: 1,
           link: '',
           details: '',
           cost
       }]);
  };

  const calculatedTotal = rows.reduce((sum, row) => {
    if (row.isDescriptionOnly) return sum;
    if (row.isOmaggio) return sum;
    const q = (row.quantity === undefined || row.quantity === null || isNaN(row.quantity)) ? 0 : row.quantity;
    const p = (row.price === undefined || row.price === null || isNaN(row.price)) ? 0 : row.price;
    const d = (row.discount === undefined || row.discount === null || isNaN(row.discount)) ? 0 : row.discount;
    const discountedPrice = p * (1 - d / 100);
    return sum + (q * discountedPrice);
  }, 0);

  const grandTotal = customTotal !== null ? customTotal : calculatedTotal;
  const internalTotal = internalRows.reduce((sum, row) => sum + ((row.quantity || 0) * (row.cost || 0)), 0);

  const generatePDF = async () => {
    purgeEmptyRows();
    setIsGeneratingPDF(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageHeight = doc.internal.pageSize.height;

      // Font settings
      doc.setFont('helvetica');

      // --- Header ---
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(companyInfo.name, 14, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text("Sede Operativa:", 14, 26);
      doc.setFont('helvetica', 'normal');
      doc.text(companyInfo.address, 42, 26);
      doc.text(`${companyInfo.cap} ${companyInfo.city}`, 14, 31);
      doc.setFont('helvetica', 'bold');
      doc.text(`P.IVA:`, 14, 36);
      doc.setFont('helvetica', 'normal');
      doc.text(`${companyInfo.vatNumber}`, 26, 36);
      doc.setFont('helvetica', 'bold');
      doc.text(`Cod. Univ.: `, 50, 36);
      doc.setFont('helvetica', 'normal');
      doc.text(`${companyInfo.sdiCode}`, 71, 36);
      doc.text(companyInfo.email, 14, 41);

      // --- Spettabile ---
      doc.setFont('helvetica', 'bold');
      doc.text("SPETTABILE", 120, 20);
      doc.setLineWidth(0.5);
      doc.line(120, 22, 190, 22);
      doc.setFont('helvetica', 'normal');
      const clientName = (clientInfo.name || '').trim();
      const clientIntestazione = (clientInfo.intestazione || '').trim();
      const displayName = (clientIntestazione && clientName && clientIntestazione !== clientName)
        ? `${clientIntestazione} - ${clientName}`
        : (clientName || clientIntestazione || '');
      
      let clientY = 28;
      const splitName = doc.splitTextToSize(displayName, 70);
      splitName.forEach((line: string) => {
        doc.text(line, 120, clientY);
        clientY += 5;
      });
      doc.text(clientInfo.address, 120, clientY);
      clientY += 5;
      doc.text(`${clientInfo.cap} ${clientInfo.city}`, 120, clientY);
      clientY += 5;
      doc.text(`P.IVA: ${clientInfo.vatNumber}`, 120, clientY);

      const prevY = Math.max(50, clientY + 7);

      // --- Prev info ---
      doc.setFont('helvetica', 'bold');
      doc.text(`Prev. N° : ${quotationNumber}`, 120, prevY);
      doc.text(`Del : ${quotationDate.split('-').reverse().join('/')}`, 160, prevY);

      // --- Table ---
      autoTable(doc, {
          startY: prevY + 10,
          head: [['Q.tà', 'DESCRIZIONE', 'PREZZO']],
          body: rows.filter(r => !isRowEmpty(r)).map(r => {
              const descFormatted = r.isDescriptionOnly 
                ? cleanHtmlText(r.description || '') 
                : (r.description || '').toUpperCase();
                
              if (r.isDescriptionOnly) {
                  return ['', descFormatted, ''];
              }
              const qStr = (r.quantity === undefined || r.quantity === null || isNaN(r.quantity)) ? '' : r.quantity.toString();
              
              const pBase = (r.price === undefined || r.price === null || isNaN(r.price)) ? 0 : r.price;
              const disc = (r.discount === undefined || r.discount === null || isNaN(r.discount)) ? 0 : r.discount;
              const discountedPrice = pBase * (1 - disc / 100);

              let pStr = '';
              if (r.isOmaggio) {
                  pStr = 'Omaggio';
              } else if (r.price === undefined || r.price === null || isNaN(r.price)) {
                  pStr = '';
              } else {
                  if (disc > 0) {
                      pStr = `€ ${pBase.toFixed(2)}\n(-${disc}%) € ${discountedPrice.toFixed(2)}`;
                  } else {
                      pStr = `€ ${pBase.toFixed(2)}`;
                  }
              }
              return [qStr, descFormatted, pStr];
          }),
          headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.2, lineColor: 0 },
          theme: 'plain',
          styles: { fontSize: 10 },
          columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 35, halign: 'right' } },
          didParseCell: function(data) {
              if (data.row.section === 'body') {
                  const activeRows = rows.filter(r => !isRowEmpty(r));
                  const r = activeRows[data.row.index];
                  if (r) {
                      if (r.isDescriptionOnly) {
                          data.cell.styles.fontStyle = 'normal';
                      } else {
                          data.cell.styles.fontStyle = 'bold';
                      }
                  }
                  if (data.row.index % 2 === 0) {
                      data.cell.styles.fillColor = [245, 245, 245];
                  }
              }
          },
          willDrawCell: function(data) {
              if (data.row.section === 'body' && data.column.index === 1) {
                  const textLines = data.cell.text || [];
                  const rawText = textLines.join('\n');
                  if (rawText.includes('**') || rawText.includes('<b>') || rawText.includes('<strong>')) {
                      const bgColor = (data.row.index % 2 === 0 ? [245, 245, 245] : [255, 255, 255]) as [number, number, number];
                      data.cell.styles.textColor = bgColor;
                  }
              }
          },
          didDrawCell: function(data) {
              if (data.row.section === 'body' && data.column.index === 1) {
                  const textLines = data.cell.text || [];
                  const rawText = textLines.join('\n');
                  if (rawText.includes('**') || rawText.includes('<b>') || rawText.includes('<strong>')) {
                      const cell = data.cell;
                      const doc = data.doc;
                      const padding = cell.styles.cellPadding;
                      let topPadding = 0;
                      let leftPadding = 0;
                      if (typeof padding === 'number') {
                          topPadding = padding;
                          leftPadding = padding;
                      } else if (Array.isArray(padding)) {
                          if (padding.length === 2) {
                              topPadding = padding[0];
                              leftPadding = padding[1];
                          } else if (padding.length === 4) {
                              topPadding = padding[0];
                              leftPadding = padding[3];
                          }
                      } else if (padding && typeof padding === 'object') {
                          topPadding = (padding as any).top || 0;
                          leftPadding = (padding as any).left || 0;
                      }
                      
                      const scaleFactor = doc.internal.scaleFactor || 2.8346;
                      const lineHeight = (doc.getLineHeight() || 11.5) / scaleFactor;
                      
                      let currentY = cell.y + topPadding + (doc.getFontSize() / scaleFactor) * 0.8;
                      
                      doc.saveState();
                      
                      textLines.forEach((line: string) => {
                          let clean = line
                            .replace(/<\/?strong>/gi, '**')
                            .replace(/<\/?b>/gi, '**');
                          const parts = clean.split('**');
                          let currentX = cell.x + leftPadding;
                          
                          parts.forEach((part, index) => {
                              if (part !== '') {
                                  const isBold = index % 2 === 1;
                                  if (isBold) {
                                      doc.setFont('helvetica', 'bold');
                                  } else {
                                      doc.setFont('helvetica', 'normal');
                                  }
                                  doc.text(part, currentX, currentY);
                                  currentX += doc.getTextWidth(part);
                              }
                          });
                          currentY += lineHeight;
                      });
                      
                      doc.restoreState();
                  }
              }
          }
      });

      let currentY = (doc as any).lastAutoTable.finalY + 10;
      if (showTotal) {
          doc.setFillColor(230, 230, 230);
          doc.rect(14, currentY, 182, 8, 'F');
          doc.setFont('helvetica', 'bold');
          doc.text(`Totale: € ${grandTotal.toFixed(2)}`, 185, currentY + 6, { align: 'right' });
          currentY += 15;
      } else {
          currentY += 5;
      }

      // --- Dettagli Fornitura (Trasporto, Installazione, Collaudo, Validità) ---
      if (trasporto || installazione || collaudo || validita) {
          if (currentY > pageHeight - 50) {
              doc.addPage();
              currentY = 20;
          }
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text("CONDIZIONI DI FORNITURA / SPECIFICHE SERVIZIO:", 14, currentY);
          currentY += 6;
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          
          if (trasporto) {
              doc.setFont('helvetica', 'bold');
              doc.text("Trasporto: ", 14, currentY);
              doc.setFont('helvetica', 'normal');
              doc.text(trasporto.toUpperCase(), 45, currentY);
              currentY += 5;
          }
          if (installazione) {
              doc.setFont('helvetica', 'bold');
              doc.text("Installazione: ", 14, currentY);
              doc.setFont('helvetica', 'normal');
              doc.text(installazione.toUpperCase(), 45, currentY);
              currentY += 5;
          }
          if (collaudo) {
              doc.setFont('helvetica', 'bold');
              doc.text("Collaudo: ", 14, currentY);
              doc.setFont('helvetica', 'normal');
              doc.text(collaudo.toUpperCase(), 45, currentY);
              currentY += 5;
          }
          if (validita) {
              doc.setFont('helvetica', 'bold');
              doc.text("Validità Preventivo: ", 14, currentY);
              doc.setFont('helvetica', 'normal');
              doc.text(validita.toUpperCase(), 50, currentY);
              currentY += 5;
          }
          currentY += 5;
      }

      // --- Notes ---
      if (notes) {
          doc.setFont('helvetica', 'bold');
          doc.text("Note:", 14, currentY);
          currentY += 5;
          const notesDiv = document.createElement('div');
          notesDiv.innerHTML = notes;
          notesDiv.style.width = '182mm';
          notesDiv.style.fontFamily = 'Helvetica';
          const notesStyle = document.createElement('style');
          notesStyle.innerHTML = PDF_STYLES;
          notesDiv.appendChild(notesStyle);
          document.body.appendChild(notesDiv);
          await doc.html(notesDiv, { x: 14, y: currentY, width: 182, windowWidth: 1000 });
          
          // Measure roughly
          currentY += 40; 
          document.body.removeChild(notesDiv);
      }

      // --- Condizioni ---
      if (condizioni) {
          const condDiv = document.createElement('div');
          condDiv.innerHTML = condizioni;
          condDiv.style.width = '182mm'; // Extended to max width
          condDiv.style.fontFamily = 'Helvetica';
          condDiv.className = 'pdf-conditions-container';
          const condStyle = document.createElement('style');
          condStyle.innerHTML = PDF_STYLES + `\n.pdf-conditions-container { text-align: center !important; width: 100% !important; margin: 0 auto !important; page-break-inside: avoid !important; } \n.pdf-conditions-container * { text-align: center !important; }`;
          condDiv.appendChild(condStyle);

          document.body.appendChild(condDiv);
          await doc.html(condDiv, { x: 14, y: currentY, width: 182, windowWidth: 1000 });
          
          currentY += 80; 
          document.body.removeChild(condDiv);
      }

      // --- Page Numbering ---
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          const pageSize = doc.internal.pageSize;
          const pWidth = typeof pageSize.getWidth === 'function' ? pageSize.getWidth() : pageSize.width;
          const pHeight = typeof pageSize.getHeight === 'function' ? pageSize.getHeight() : pageSize.height;
          doc.text(`Pagina ${i} di ${pageCount}`, pWidth - 10, pHeight - 7, { align: 'right' });
      }

      const fileClientName = (clientInfo.intestazione && clientInfo.name && clientInfo.intestazione.trim() !== clientInfo.name.trim())
        ? `${clientInfo.intestazione.trim()} - ${clientInfo.name.trim()}`
        : (clientInfo.name || clientInfo.intestazione || '').trim();
      
      const defaultFilename = `${quotationNumber}_${quotationYear} - ${fileClientName}.pdf`;
      setPdfFilename(defaultFilename);
      setPendingPdfDoc(doc);
      setShowPdfSaveModal(true);
    } catch (e) {
      console.error("Error generating PDF:", e);
    } finally {
      setIsGeneratingPDF(false);
    }
  }

  const handleSavePdfConfirmed = async (useSystemPicker: boolean) => {
    if (!pendingPdfDoc) return;
    
    let finalFilename = pdfFilename.trim();
    if (!finalFilename) {
      const fileClientName = (clientInfo.intestazione && clientInfo.name && clientInfo.intestazione.trim() !== clientInfo.name.trim())
        ? `${clientInfo.intestazione.trim()} - ${clientInfo.name.trim()}`
        : (clientInfo.name || clientInfo.intestazione || '').trim();
      finalFilename = `${quotationNumber}_${quotationYear} - ${fileClientName}.pdf`;
    }
    if (!finalFilename.toLowerCase().endsWith('.pdf')) {
      finalFilename += '.pdf';
    }

    try {
      if (useSystemPicker && typeof (window as any).showSaveFilePicker === 'function') {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: finalFilename,
          types: [{
            description: 'Documento PDF',
            accept: {
              'application/pdf': ['.pdf'],
            },
          }],
        });
        const writable = await fileHandle.createWritable();
        const pdfBlob = pendingPdfDoc.output('blob');
        await writable.write(pdfBlob);
        await writable.close();
      } else {
        pendingPdfDoc.save(finalFilename);
      }
    } catch (err: any) {
      console.error("Errore salvataggio file picker:", err);
      if (err.name !== 'AbortError') {
        pendingPdfDoc.save(finalFilename);
      }
    } finally {
      setShowPdfSaveModal(false);
      setPendingPdfDoc(null);
    }
  };

  const addDescriptionRow = (index: number) => {
    const newRow: QuotationRow = { id: Math.random().toString(), description: '', quantity: undefined, price: undefined, isDescriptionOnly: true };
    setRows(prevRows => {
        const newRows = [...prevRows];
        newRows.splice(index + 1, 0, newRow);
        return newRows;
    });
  };

  useEffect(() => {
    getCompanyProfile().then(data => {
      if (data) {
        setCompanyInfo(data);
        setCondizioni(data.conditionsText);
      }
    });

    if (props.editingQuotation) {
        setClientInfo(props.editingQuotation.clientInfo);
        setRows(props.editingQuotation.rows || []);
        setInternalRows(props.editingQuotation.internalRows || []);
        setNotes(props.editingQuotation.notes || '');
        setInternalNotes(props.editingQuotation.internalNotes || '');
        setShowTotal(props.editingQuotation.showTotal !== false);
        const hasAttachment = props.editingQuotation.attachment || null;
        setAttachment(hasAttachment);
        const loadedAttachments = props.editingQuotation.attachmentsList || (hasAttachment ? [hasAttachment] : []);
        setAttachmentsList(loadedAttachments);
        setIsNasLink(isNasLinkPath(hasAttachment));
        setNasPathInput(isNasLinkPath(hasAttachment) ? hasAttachment || '' : '');
        
        const rawNum = props.editingQuotation.number || '';
        const separatorIndex = rawNum.indexOf('/') !== -1 ? rawNum.indexOf('/') : rawNum.indexOf('-');
        if (separatorIndex !== -1) {
            setQuotationNumber(rawNum.substring(0, separatorIndex));
            setQuotationLetter(rawNum.substring(separatorIndex + 1));
        } else {
            setQuotationNumber(rawNum);
            setQuotationLetter('');
        }
        
        setQuotationYear(props.editingQuotation.year);
        setQuotationDate(props.editingQuotation.date);
        
        setTrasporto(props.editingQuotation.trasporto !== undefined ? props.editingQuotation.trasporto : 'incluso');
        setInstallazione(props.editingQuotation.installazione !== undefined ? props.editingQuotation.installazione : 'inclusa');
        setCollaudo(props.editingQuotation.collaudo !== undefined ? props.editingQuotation.collaudo : 'incluso');
        setValidita(props.editingQuotation.validita !== undefined ? props.editingQuotation.validita : '');

        setForceQuotationNumber(true);
        const loadedRows = props.editingQuotation.rows || [];
        const calcLoadedTotal = loadedRows.reduce((sum, row) => {
            if (row.isDescriptionOnly) return sum;
            if (row.isOmaggio) return sum;
            const q = row.quantity || 0;
            const p = row.price || 0;
            const d = row.discount || 0;
            return sum + (q * p * (1 - d / 100));
        }, 0);
        if (props.editingQuotation.totalAmount !== undefined && Math.abs(calcLoadedTotal - props.editingQuotation.totalAmount) > 0.05) {
            setCustomTotal(props.editingQuotation.totalAmount);
        } else {
            setCustomTotal(null);
        }
    } else {
        setAttachment(null);
        setAttachmentsList([]);
        setIsNasLink(false);
        setNasPathInput('');
        setSelectedFileName(null);
        setStagedLocalPath('');
        setTrasporto('incluso');
        setInstallazione('inclusa');
        setCollaudo('incluso');
        setValidita('');
        setForceQuotationNumber(false);
        setCustomTotal(null);
        getQuotations().then(data => {
            const year = new Date().getFullYear();
            const sameYear = data.filter(q => q.year === year);
            const maxNumber = sameYear.length > 0 ? Math.max(...sameYear.map(q => parseInt(q.number) || 0)) : 0;
            setQuotationNumber((maxNumber + 1).toString());
        });
    }
  }, [props.editingQuotation]);

  const updateRow = (id: string, field: keyof QuotationRow, value: any) => {
    setRows(prevRows => prevRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const addRow = () => {
    setRows(prevRows => [...prevRows, { id: Date.now().toString(), description: '', quantity: undefined, price: undefined }]);
  };

  const updateInternalRow = (id: string, field: keyof InternalRow, value: string | number) => {
      let finalVal = value;
      if (field === 'cost' && typeof value === 'number') {
        finalVal = Math.round(value * 100) / 100;
      }
      setInternalRows(prevRows => prevRows.map(row => row.id === id ? { ...row, [field]: finalVal } : row));
  }

  const addInternalRow = () => {
      setInternalRows(prevRows => [...prevRows, { id: Date.now().toString(), description: '', quantity: 0, link: '', details: '', cost: 0 }]);
  }

  const [isParsingPdf, setIsParsingPdf] = useState(false);

  const handlePdfAutoImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingPdf(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        try {
          // 1. Extract text from PDF
          const extractedText = await extractTextFromPdf(dataUrl);
          if (!extractedText || extractedText.trim().length === 0) {
            throw new Error("Impossibile estrarre testo leggibile dal PDF.");
          }

          // 2. Call server-side Gemini API
          const prompt = `Analizza il seguente testo estratto da un preventivo PDF e convertilo in un oggetto JSON strutturato secondo questo schema.
IMPORTANTE: Restituisci ESCLUSIVAMENTE il codice JSON puro, senza alcun markup markdown (NON inserire \`\`\`json o \`\`\`), senza testo introduttivo o conclusivo. Il risultato deve essere direttamente parsabile con JSON.parse.

Schema JSON richiesto:
{
  "clientInfo": {
    "name": "Nome o Ragione Sociale del cliente",
    "intestazione": "Eventuale intestazione o Ragione Sociale completa",
    "email": "Email del cliente",
    "address": "Indirizzo del cliente",
    "phone": "Telefono del cliente",
    "vatNumber": "Partita IVA o Codice Fiscale del cliente",
    "sdiCode": "Codice SDI o PEC se disponibile",
    "cap": "CAP",
    "city": "Città/Comune"
  },
  "quotationNumber": "Numero del preventivo (stringa, solo numero principale)",
  "quotationYear": 2026, // Anno estratto o anno corrente se non trovato (numero)
  "quotationDate": "YYYY-MM-DD", // Data del preventivo nel formato ISO indicato
  "rows": [
    {
      "description": "Descrizione della voce/riga",
      "quantity": 1, // Quantità (numero decimale o intero)
      "price": 100.0 // Prezzo unitario (numero decimale o intero)
    }
  ],
  "notes": "Altre note rilevanti estratte dal preventivo (facoltativo)"
}

Ecco il testo del PDF da analizzare:
\${extractedText}`;

          const res = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
          });

          if (!res.ok) {
            throw new Error("Errore durante la chiamata all'API Gemini.");
          }

          const resData = await res.json();
          if (!resData.success || !resData.response) {
            throw new Error(resData.error || "L'API non ha restituito una risposta valida.");
          }

          const cleanJsonText = resData.response.trim().replace(/^```json/, '').replace(/```$/, '').trim();
          const parsed = JSON.parse(cleanJsonText);

          // 3. Populate state
          if (parsed.clientInfo) {
            // Find existing client or set extracted details
            const allClients = await getClients();
            const cleanVat = (parsed.clientInfo.vatNumber || '').trim();
            const cleanName = (parsed.clientInfo.name || '').trim().toLowerCase();
            const existingClient = allClients.find(c => 
              (cleanVat && c.vatNumber === cleanVat) || 
              (cleanName && (c.name || '').toLowerCase() === cleanName) ||
              (cleanName && (c.intestazione || '').toLowerCase() === cleanName)
            );

            if (existingClient) {
              setClientInfo(existingClient);
              alert(`Cliente trovato nel database: \${existingClient.name || existingClient.intestazione}`);
            } else {
              // Create temporary client with extracted details
              const tempClient = {
                id: 'temp-' + Date.now(),
                name: parsed.clientInfo.name || '',
                intestazione: parsed.clientInfo.intestazione || '',
                email: parsed.clientInfo.email || '',
                address: parsed.clientInfo.address || '',
                phone: parsed.clientInfo.phone || '',
                vatNumber: parsed.clientInfo.vatNumber || '',
                sdiCode: parsed.clientInfo.sdiCode || '',
                cap: parsed.clientInfo.cap || '',
                city: parsed.clientInfo.city || ''
              };
              
              // Automatically add client to database to have a valid persistent ID
              try {
                const added = await addClient({
                  name: tempClient.name || tempClient.intestazione || 'Nuovo Cliente PDF',
                  intestazione: tempClient.intestazione,
                  email: tempClient.email,
                  address: tempClient.address,
                  phone: tempClient.phone,
                  vatNumber: tempClient.vatNumber,
                  sdiCode: tempClient.sdiCode,
                  cap: tempClient.cap,
                  city: tempClient.city
                });
                tempClient.id = added.id;
                setClientInfo(tempClient);
                alert(`Nuovo cliente estratto e salvato automaticamente nel database: \${tempClient.name || tempClient.intestazione}`);
              } catch (clientErr) {
                // Fallback to temp-id if client save fails
                setClientInfo(tempClient);
              }
            }
          }

          if (parsed.quotationNumber) {
            const rawNum = parsed.quotationNumber;
            const slashIndex = rawNum.indexOf('/');
            if (slashIndex !== -1) {
              setQuotationNumber(rawNum.substring(0, slashIndex));
              setQuotationLetter(rawNum.substring(slashIndex + 1));
            } else {
              setQuotationNumber(rawNum);
              setQuotationLetter('');
            }
          }

          if (parsed.quotationYear) {
            setQuotationYear(parsed.quotationYear);
          }
          if (parsed.quotationDate) {
            setQuotationDate(parsed.quotationDate);
          }

          if (Array.isArray(parsed.rows) && parsed.rows.length > 0) {
            const mappedRows = parsed.rows.map((r: any, idx: number) => ({
              id: 'pdf-' + idx + '-' + Date.now(),
              description: r.description || '',
              quantity: typeof r.quantity === 'number' ? r.quantity : 1,
              price: typeof r.price === 'number' ? r.price : 0
            }));
            setRows(mappedRows);
          }

          if (parsed.notes) {
            setNotes(parsed.notes);
          }

          alert("Compilazione automatica da PDF completata con successo!");
        } catch (err: any) {
          console.error("Errore nell'elaborazione del PDF:", err);
          alert(`Errore nell'analisi del PDF con AI: \${err.message || err}`);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      alert(`Errore di lettura del file: \${err.message}`);
    } finally {
      setIsParsingPdf(false);
      // Clear input value so same file can be uploaded again
      e.target.value = '';
    }
  };

  const extractTextFromPdf = async (pdfDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const startTextExtraction = async (pdfjsLib: any) => {
        try {
          const base64Content = pdfDataUrl.split(',')[1];
          const raw = window.atob(base64Content);
          const rawLength = raw.length;
          const array = new Uint8Array(new ArrayBuffer(rawLength));
          for (let i = 0; i < rawLength; i++) {
            array[i] = raw.charCodeAt(i);
          }

          const loadingTask = pdfjsLib.getDocument({ data: array });
          const pdf = await loadingTask.promise;
          let fullText = "";

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(" ");
            fullText += `--- Pagina \${pageNum} ---\n` + pageText + "\n";
          }

          resolve(fullText);
        } catch (error) {
          reject(error);
        }
      };

      if (!(window as any).pdfjsLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
        script.onload = () => {
          const pdfjsLib = (window as any).pdfjsLib;
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
          startTextExtraction(pdfjsLib);
        };
        script.onerror = (e) => reject(new Error('Impossibile caricare la libreria PDF.js per l\'estrazione del testo.'));
        document.head.appendChild(script);
      } else {
        const pdfjsLib = (window as any).pdfjsLib;
        startTextExtraction(pdfjsLib);
      }
    });
  };

  const validateQuotation = async (showSuccessAlert: boolean = true): Promise<{ isValid: boolean, correctedNumber?: string }> => {
    // 1. Check Dati Azienda in tab "anagrafica"
    if (!companyInfo.name || !companyInfo.name.trim()) {
        alert("Errore di Validazione:\nI Dati Azienda non sono completi. Compila il profilo azienda nelle impostazioni.");
        setActiveTab('anagrafica');
        return { isValid: false };
    }

    // 2. Check Dati Cliente in tab "anagrafica"
    if (!clientInfo.id || !clientInfo.name || !clientInfo.name.trim()) {
        alert("Errore di Validazione:\nI Dati Cliente non sono completi. Seleziona o importa un cliente valido.");
        setActiveTab('anagrafica');
        return { isValid: false };
    }

    // 3. Check Preventivo rows in tab "preventivo"
    // A row is "fully compiled" if it has Q.tà, Descrizione and Prezzo CAD
    const fullyCompiledRows = rows.filter(row => {
        if (row.isDescriptionOnly) return false;
        const q = row.quantity;
        const p = row.price;
        const d = row.description;
        return (q !== undefined && q !== null && !isNaN(q) && q > 0) &&
               (p !== undefined && p !== null && !isNaN(p) && p >= 0) &&
               (d !== undefined && d !== null && d.trim() !== '');
    });

    if (fullyCompiledRows.length === 0) {
        alert("Errore di Validazione:\nNessuna riga del preventivo è compilata correttamente. Assicurati che nella tab Preventivo ci sia almeno una riga con Q.tà, Descrizione e Prezzo CAD compilati.");
        setActiveTab('preventivo');
        return { isValid: false };
    }

    // Check if there are "partially compiled" rows (which would be corrupt or partial)
    const partiallyCompiledRows = rows.filter(row => {
        if (row.isDescriptionOnly) return false;
        const hasQ = row.quantity !== undefined && row.quantity !== null && !isNaN(row.quantity);
        const hasP = row.price !== undefined && row.price !== null && !isNaN(row.price);
        const hasD = row.description !== undefined && row.description !== null && row.description.trim() !== '';
        
        const isSomeFilled = hasQ || hasP || hasD;
        const isAllFilled = hasQ && hasP && hasD;
        
        return isSomeFilled && !isAllFilled;
    });

    if (partiallyCompiledRows.length > 0) {
        alert(`Errore di Validazione:\nCi sono ${partiallyCompiledRows.length} righe parzialmente compilate o corrotte nella tab Preventivo. Completa tutti i campi (Q.tà, Descrizione, Prezzo CAD) per queste righe, oppure eliminale.`);
        setActiveTab('preventivo');
        return { isValid: false };
    }

    // 4. Check if the grand total of fully compiled rows is correct
    const calculatedTotal = rows.reduce((sum, row) => {
        if (row.isDescriptionOnly) return sum;
        if (row.isOmaggio) return sum;
        const q = row.quantity || 0;
        const p = row.price || 0;
        const d = row.discount || 0;
        return sum + (q * p * (1 - d / 100));
    }, 0);

    if (customTotal === null && Math.abs(calculatedTotal - grandTotal) > 0.1) {
        alert(`Errore di Validazione:\nIl calcolo del totale preventivo non corrisponde. Totale calcolato: € ${calculatedTotal.toFixed(2)}, Totale a video: € ${grandTotal.toFixed(2)}.`);
        setActiveTab('preventivo');
        return { isValid: false };
    }

    // 5. Check progressive uniqueness & auto-increment
    const allQuotations = await getQuotations();
    const sameYearQuotations = allQuotations.filter(q => q.year === quotationYear);
    
    let maxProg = 0;
    sameYearQuotations.forEach(q => {
        const rawNum = q.number || '';
        const sepIndex = rawNum.indexOf('/') !== -1 ? rawNum.indexOf('/') : rawNum.indexOf('-');
        const baseStr = sepIndex !== -1 ? rawNum.substring(0, sepIndex) : rawNum;
        const numPart = parseInt(baseStr);
        if (!isNaN(numPart) && numPart > maxProg) {
            maxProg = numPart;
        }
    });

    const currentNum = parseInt(quotationNumber);
    const finalLetter = quotationLetter.trim();
    const hasLetterVariant = finalLetter !== '';

    let checkedNumber = quotationNumber;
    let correctedNumber: string | undefined = undefined;

    if (currentNum <= maxProg && !hasLetterVariant && !forceQuotationNumber) {
        // If editing, check if we changed the original number to a duplicate
        let isEditingOriginalNumber = false;
        if (props.editingQuotation) {
            const origNum = props.editingQuotation.number || '';
            const origSepIndex = origNum.indexOf('/') !== -1 ? origNum.indexOf('/') : origNum.indexOf('-');
            const origBaseStr = origSepIndex !== -1 ? origNum.substring(0, origSepIndex) : origNum;
            const origNumPart = parseInt(origBaseStr);
            isEditingOriginalNumber = origNumPart === currentNum && !(origNum.includes('/') || origNum.includes('-'));
        }

        if (!isEditingOriginalNumber) {
            const nextProg = maxProg + 1;
            setQuotationNumber(nextProg.toString());
            alert(`L'ultimo preventivo progressivo rilevato nel sistema è il ${maxProg}.\n\nIl numero di questo preventivo è stato impostato automaticamente a ${nextProg} per evitare conflitti.`);
            checkedNumber = nextProg.toString();
            correctedNumber = nextProg.toString();
        }
    }

    // Check duplicate of number-letter-data
    const duplicate = sameYearQuotations.find(q => {
        if (props.editingQuotation && q.id === props.editingQuotation.id) return false;

        const reconstructDb = String(q.number).toUpperCase().replace('/', '-').trim();
        const currentReconstruct = (finalLetter ? `${checkedNumber}-${finalLetter}` : `${checkedNumber}`).toUpperCase().replace('/', '-').trim();

        const numLetMatches = reconstructDb === currentReconstruct;
        const dateMatches = q.date === quotationDate;

        return numLetMatches && dateMatches;
    });

    if (duplicate) {
        alert(`Errore di Validazione:\nEsiste già un preventivo con lo stesso progressivo, variante lettera e data (${quotationDate})! Scegli un numero, una lettera o una data differenti.`);
        return { isValid: false };
    }

    if (showSuccessAlert) {
        alert("Validazione Conclusa con Successo!\nTutti i dati inseriti sono corretti e conformi.");
    }
    return { isValid: true, correctedNumber };
  };

  const handleSave = async () => {
    const validationResult = await validateQuotation(false);
    if (!validationResult.isValid) return;

    const resolvedNumber = validationResult.correctedNumber || quotationNumber;
    let finalNumber = resolvedNumber.trim();
    if (quotationLetter.trim()) {
        finalNumber = `${resolvedNumber.trim()}-${quotationLetter.trim()}`;
    }

    const activeRows = rows.filter(row => !isRowEmpty(row));
    const rowsToSave = activeRows;

    try {
        const quotation: Omit<Quotation, 'id'> = {
            clientId: clientInfo.id,
            number: finalNumber,
            year: quotationYear,
            status: 'DRAFT',
            date: quotationDate,
            totalAmount: grandTotal,
            companyInfo,
            clientInfo,
            rows: rowsToSave.map(r => ({ 
                id: r.id, 
                description: r.isDescriptionOnly ? (r.description || '') : (r.description || '').toUpperCase(), 
                quantity: (r.quantity === undefined || r.quantity === null || isNaN(r.quantity as number)) ? null : r.quantity, 
                price: (r.price === undefined || r.price === null || isNaN(r.price as number)) ? null : r.price, 
                isDescriptionOnly: !!r.isDescriptionOnly,
                isOmaggio: !!r.isOmaggio,
                discount: (r.discount === undefined || r.discount === null || isNaN(r.discount as number)) ? null : r.discount
            })),
            notes: notes || '',
            internalNotes: internalNotes || '',
            internalRows: internalRows.map(r => ({
                id: r.id,
                description: r.description || '',
                quantity: isNaN(r.quantity) ? 0 : r.quantity,
                link: r.link || '',
                details: r.details || '',
                cost: isNaN(r.cost) ? 0 : r.cost
            })),
            condizioni: condizioni,
            presentationText: '',
            showTotal: showTotal,
            trasporto,
            installazione,
            collaudo,
            validita,
            attachment: attachmentsList.length > 0 ? attachmentsList[0] : undefined,
            attachmentsList: attachmentsList.length > 0 ? attachmentsList : undefined
        };

        if (props.editingQuotation && props.editingQuotation.id) {
            await updateQuotation(props.editingQuotation.id, quotation);
        } else {
            await saveQuotation(quotation);
        }
        
        alert(`Preventivo ${finalNumber}/${quotationYear % 100} salvato con successo!`);
        if (props.onSave) props.onSave();
    } catch (e: any) {
        alert(`Errore nel salvataggio: ${e.message}`);
    }
  };

  return (
    <div className="space-y-8 pb-20 p-4 min-h-screen bg-gray-800">
      <div className="bg-gray-200 p-6 rounded-lg shadow-sm border border-gray-300 text-gray-900">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Scheda Preventivo</h2>
        <div className="flex border-b border-gray-400 mb-4 justify-between items-center">
            <div className='flex'>
                {tabs.map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm ${activeTab === tab.id ? 'border-b-2 border-gray-700 font-bold text-gray-900' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'}`}
                    >
                        {React.cloneElement(tab.icon as React.ReactElement, { size: 16 })}
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="flex gap-2 items-center text-gray-900">
                <div className="flex items-center gap-1 bg-white/50 hover:bg-white px-2 py-1.5 rounded border border-gray-450 transition-all">
                  <input 
                    id="checkbox-force-prog"
                    type="checkbox" 
                    className="w-3.5 h-3.5 text-purple-600 border-gray-400 rounded focus:ring-purple-500 cursor-pointer"
                    checked={forceQuotationNumber}
                    onChange={e => setForceQuotationNumber(e.target.checked)}
                  />
                  <label htmlFor="checkbox-force-prog" className="text-[10px] font-bold text-purple-800 cursor-pointer select-none tracking-wide" title="Forza il numero progressivo escludendo i controlli automatici">
                    FORZA N°
                  </label>
                </div>
                <input type="text" className="w-16 p-1 border border-gray-400 rounded text-sm bg-gray-100" placeholder="N°" value={quotationNumber} onChange={e => setQuotationNumber(e.target.value)} />
                <select className="w-12 p-1 border border-gray-400 rounded text-sm bg-gray-100" value={quotationLetter} onChange={e => setQuotationLetter(e.target.value)}>
                    <option value="">-</option>
                    {...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select className="w-20 p-1 border border-gray-400 rounded text-sm bg-gray-100" value={quotationYear} onChange={e => setQuotationYear(parseInt(e.target.value))}>
                    {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <input type="date" className="w-32 p-1 border border-gray-400 rounded text-sm bg-gray-100" value={quotationDate} onChange={e => setQuotationDate(e.target.value)} />
            </div>
        </div>
        
        
        
        <div className="space-y-6">
            {activeTab === 'anagrafica' && (
                <div>
                    <div className='flex justify-end mb-2'>
                        <button onClick={() => setActiveTab(null)} className="text-gray-700 hover:text-gray-900 text-sm">Chiudi</button>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-gray-100 p-6 rounded-lg shadow-sm border border-gray-300">
                          <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold text-gray-900">Dati Azienda</h4>
                          </div>
                          <div className="space-y-1 text-sm mb-4 text-gray-800">
                            <p className="font-bold">{companyInfo.name}</p>
                            <p>{companyInfo.address}, {companyInfo.cap} {companyInfo.city}</p>
                            <p>Tel: {companyInfo.phone}</p>
                            <p>Email: {companyInfo.email}</p>
                            <p>PEC: {companyInfo.pec}</p>
                            <p>P.IVA: {companyInfo.vatNumber}</p>
                            <p>SDI: {companyInfo.sdiCode}</p>
                          </div>
                        </div>
                        <div className="bg-gray-100 p-6 rounded-lg shadow-sm border border-gray-300">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-900">Dati Cliente</h4>
                            <div className="flex flex-col items-end gap-2">
                              <button onClick={() => setShowClientSelector(true)} className="text-sm bg-gray-300 px-2 py-1 rounded hover:bg-gray-400 text-gray-900">Importa</button>
                              <button 
                                onClick={handleGoToNewClient}
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-700 hover:bg-blue-800 text-white shadow hover:shadow-md transition-all relative border border-blue-600 cursor-pointer group"
                                title="Aggiungi Nuovo Cliente in Anagrafica"
                              >
                                <Notebook size={14} />
                                <span className="absolute -top-1 -right-1 bg-emerald-500 text-white font-extrabold rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center border border-white">
                                  +
                                </span>
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 text-sm text-gray-800">
                            <p className="font-bold">
                              {(() => {
                                const cName = (clientInfo.name || '').trim();
                                const cInt = (clientInfo.intestazione || '').trim();
                                if (cInt && cName && cInt !== cName) {
                                  return `${cInt} - ${cName}`;
                                }
                                return cName || cInt || 'Nessun cliente selezionato';
                              })()}
                            </p>
                            <p>{clientInfo.address}{clientInfo.cap ? `, ${clientInfo.cap}` : ''} {clientInfo.city}</p>
                            <p>Tel: {clientInfo.phone}</p>
                            <p>Email: {clientInfo.email}</p>
                            <p>P.IVA: {clientInfo.vatNumber}</p>
                            <p>SDI: {clientInfo.sdiCode}</p>
                          </div>
                        </div>
                    </div>
                    </div>
            )}
            {activeTab === 'preventivo' && (
              <div className="bg-gray-100 p-6 rounded-lg shadow-sm border border-gray-300">
                <div className='flex justify-end mb-2'>
                    <button onClick={() => setActiveTab(null)} className="text-gray-700 hover:text-gray-900 text-sm">Chiudi</button>
                </div>
                <table className="w-full mb-4">
                  <thead>
                    <tr className="bg-gray-300 text-left text-gray-900 text-xs md:text-sm">
                      <th className="p-2 w-20">Q.tà</th>
                      <th className="p-2">Descrizione</th>
                      <th className="p-2 w-32 text-right">Prezzo CAD</th>
                      <th className="p-2 w-20 text-right">Sconto %</th>
                      <th className="p-2 w-24 text-center">Omaggio</th>
                      <th className="p-2 w-32 text-right">Totale</th>
                      <th className="p-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={`${row.id}-${index}`}>
                        {row.isDescriptionOnly ? (
                          <>
                            <td className="p-2"></td>
                            <td className="p-2" colSpan={5}>
                              <div className="w-full bg-white rounded border border-gray-400 overflow-hidden text-gray-900 secondary-row-quill">
                                <QuillEditor 
                                  value={row.description || ''} 
                                  onChange={content => updateRow(row.id, 'description', content)} 
                                />
                              </div>
                            </td>
                            <td className="p-2 text-center flex items-center justify-center gap-1">
                                <button onClick={() => addDescriptionRow(index)} className="text-gray-700 bg-gray-200 px-1.5 py-0.5 rounded text-xs hover:bg-gray-300 font-bold cursor-pointer" title="Inserisci riga descrittiva">+</button>
                                <button onClick={() => deleteRow(row.id)} className="text-rose-600 hover:text-rose-800 p-0.5 cursor-pointer" title="Elimina riga"><Trash2 size={15} /></button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2">
                              <input 
                                type="number" 
                                className="w-full p-1 border border-gray-400 rounded font-bold bg-white text-gray-900" 
                                value={row.quantity === undefined || row.quantity === null || isNaN(row.quantity) ? '' : row.quantity} 
                                onChange={e => updateRow(row.id, 'quantity', e.target.value === '' ? undefined : parseFloat(e.target.value))} 
                              />
                            </td>
                            <td className="p-2">
                              <textarea 
                                rows={Math.max(1, Math.ceil((row.description || '').length / 60) + (row.description || '').split('\n').length - 1)}
                                className="w-full p-1 border border-gray-400 rounded font-bold bg-white text-gray-900 uppercase focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs md:text-sm" 
                                style={{ minHeight: '34px', resize: 'vertical' }}
                                placeholder="Descrizione principale (maiuscolo)..."
                                value={row.description} 
                                onChange={e => updateRow(row.id, 'description', e.target.value)} 
                              />
                            </td>
                            <td className="p-2 text-right">
                              <input 
                                type="number" 
                                className="w-full p-1 border border-gray-400 rounded font-bold text-right bg-white text-gray-900 mb-1" 
                                value={row.price === undefined || row.price === null || isNaN(row.price) ? '' : row.price} 
                                onChange={e => updateRow(row.id, 'price', e.target.value === '' ? undefined : parseFloat(e.target.value))} 
                              />
                              {row.discount !== undefined && row.discount !== null && !isNaN(row.discount) && row.discount > 0 && row.price !== undefined && row.price !== null && !isNaN(row.price) && (
                                <div className="text-[10px] md:text-xs text-rose-600 font-bold leading-tight">
                                  Scontato: €{((row.price) * (1 - row.discount / 100)).toFixed(2)}
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-right">
                              <input 
                                type="number" 
                                min="0"
                                max="100"
                                placeholder="0"
                                className="w-full p-1 border border-gray-400 rounded font-semibold text-right bg-white text-gray-900" 
                                value={row.discount === undefined || row.discount === null || isNaN(row.discount) ? '' : row.discount} 
                                onChange={e => updateRow(row.id, 'discount', e.target.value === '' ? undefined : parseFloat(e.target.value))} 
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 cursor-pointer align-middle" 
                                checked={!!row.isOmaggio} 
                                onChange={e => updateRow(row.id, 'isOmaggio', e.target.checked)} 
                              />
                            </td>
                            <td className="p-2 text-right text-gray-900 font-bold">
                                {row.isOmaggio ? (
                                  <span className="text-green-700 font-bold text-sm">Omaggio</span>
                                ) : (
                                  (() => {
                                    const qty = (row.quantity === undefined || row.quantity === null || isNaN(row.quantity)) ? 0 : row.quantity;
                                    const prc = (row.price === undefined || row.price === null || isNaN(row.price)) ? 0 : row.price;
                                    const disc = (row.discount === undefined || row.discount === null || isNaN(row.discount)) ? 0 : row.discount;
                                    const discounted = prc * (1 - disc / 100);
                                    return `€ ${(qty * discounted).toFixed(2)}`;
                                  })()
                                )}
                            </td>
                            <td className="p-2 text-center flex items-center justify-center gap-1">
                                <button onClick={() => addDescriptionRow(index)} className="text-gray-700 bg-gray-200 px-1.5 py-0.5 rounded text-xs hover:bg-gray-300 font-bold cursor-pointer" title="Inserisci riga descrittiva">+</button>
                                <button onClick={() => deleteRow(row.id)} className="text-rose-600 hover:text-rose-800 p-0.5 cursor-pointer" title="Elimina riga"><Trash2 size={15} /></button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {showTotal && (
                      <tr className="bg-gray-300 font-bold text-gray-900">
                          <td className="p-2" colSpan={4}>
                            <div className="flex items-center gap-2">
                              <span>Totale Preventivo</span>
                              {customTotal !== null ? (
                                <span className="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200">
                                  Personalizzato
                                </span>
                              ) : (
                                <span className="text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
                                  Automatico
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-right">
                            {customTotal !== null ? (
                              <div className="flex items-center justify-end gap-1">
                                <span>€</span>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-24 p-1 border border-purple-400 rounded text-right bg-white text-gray-900 font-bold"
                                  value={customTotal}
                                  onChange={e => setCustomTotal(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                />
                                <button
                                  type="button"
                                  onClick={() => setCustomTotal(null)}
                                  className="text-[10px] text-red-600 hover:text-red-800 px-1.5 py-0.5 border border-red-200 bg-red-50 rounded ml-1 font-semibold cursor-pointer"
                                  title="Ripristina totale calcolato in automatico"
                                >
                                  Reset
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <span>€ {grandTotal.toFixed(2)}</span>
                                <button
                                  type="button"
                                  onClick={() => setCustomTotal(grandTotal)}
                                  className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 px-2 py-0.5 border border-purple-200 rounded font-semibold transition-all cursor-pointer shadow-xs"
                                  title="Modifica manualmente il totale complessivo"
                                >
                                  Modifica
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="p-2"></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex flex-wrap gap-4">
                        <button onClick={addRow} className="flex items-center gap-2 text-blue-800 font-medium hover:text-blue-900 border border-blue-200 bg-blue-50/50 px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs md:text-sm font-semibold shadow-sm">
                          <Plus size={18} /> Aggiungi Riga
                        </button>
                        <button 
                          onClick={purgeEmptyRows}
                          className="flex items-center gap-2 text-rose-800 font-medium hover:text-rose-900 border border-rose-200 bg-rose-50 px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs md:text-sm font-semibold shadow-sm"
                          title="Rimuove tutte le righe che non hanno descrizione, quantità o prezzo"
                        >
                          <Trash2 size={16} /> Rimuovi Righe Vuote
                        </button>
                    </div>
                    <button 
                      onClick={() => setShowTotal(!showTotal)}
                      className={`flex items-center gap-2 text-xs md:text-sm px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-semibold shadow-sm ${
                        showTotal 
                          ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {showTotal ? <EyeOff size={16} /> : <Eye size={16} />}
                      {showTotal ? 'Nascondi Totale sul PDF' : 'Mostra Totale sul PDF'}
                    </button>
                </div>

                <div className="mt-6 border-t border-gray-300 pt-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 rounded-lg shadow-inner">
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider">Specifiche Servizio</label>
                    
                    {/* Trasporto Checkbox / Toggle */}
                    <div className="flex items-center gap-3">
                      <input 
                        id="checkbox-trasporto"
                        type="checkbox" 
                        className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-blue-500 cursor-pointer"
                        checked={trasporto === 'incluso'} 
                        onChange={e => setTrasporto(e.target.checked ? 'incluso' : 'a carico del cliente')} 
                      />
                      <label htmlFor="checkbox-trasporto" className="text-sm font-medium text-gray-900 cursor-pointer select-none">
                        Trasporto: <span className="font-bold">{trasporto === 'incluso' ? 'incluso' : 'a carico del cliente'}</span>
                      </label>
                    </div>

                    {/* Installazione Checkbox / Toggle */}
                    <div className="flex items-center gap-3">
                      <input 
                        id="checkbox-installazione"
                        type="checkbox" 
                        className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-blue-500 cursor-pointer"
                        checked={installazione === 'inclusa'} 
                        onChange={e => setInstallazione(e.target.checked ? 'inclusa' : 'da quantificare')} 
                      />
                      <label htmlFor="checkbox-installazione" className="text-sm font-medium text-gray-900 cursor-pointer select-none">
                        Installazione: <span className="font-bold">{installazione === 'inclusa' ? 'inclusa' : 'da quantificare'}</span>
                      </label>
                    </div>

                    {/* Collaudo Checkbox / Toggle */}
                    <div className="flex items-center gap-3">
                      <input 
                        id="checkbox-collaudo"
                        type="checkbox" 
                        className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-blue-500 cursor-pointer"
                        checked={collaudo === 'incluso'} 
                        onChange={e => setCollaudo(e.target.checked ? 'incluso' : 'non incluso')} 
                      />
                      <label htmlFor="checkbox-collaudo" className="text-sm font-medium text-gray-900 cursor-pointer select-none">
                        Collaudo: <span className="font-bold">{collaudo === 'incluso' ? 'incluso' : 'non incluso'}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'noteCliente' && (
                <div className="bg-gray-100 p-6 rounded-lg shadow-sm border border-gray-300">
                  <div className='flex justify-end mb-2'>
                      <button onClick={() => setActiveTab(null)} className="text-gray-700 hover:text-gray-900 text-sm">Chiudi</button>
                  </div>
                  <label className="block text-sm font-medium mb-1 text-gray-900">Note Cliente</label>
                  <QuillEditor 
                    value={notes} 
                    onChange={setNotes}
                  />
                </div>
            )}
            {activeTab === 'noteInterne' && (
                <div className="bg-gray-100 p-6 rounded-lg shadow-sm border border-gray-300">
                  <div className='flex justify-end mb-2'>
                      <button onClick={() => setActiveTab(null)} className="text-gray-700 hover:text-gray-900 text-sm">Chiudi</button>
                  </div>
                  <div className="mb-6">
                      <Simulator onAddInternalRow={handleAddInternalRowFromSimulator} sellingPriceDefault={grandTotal} internalRows={internalRows} />
                  </div>

                  <hr className="border-gray-400 my-4" />

                  <label className="block text-sm font-medium mb-1 text-gray-900">Note Interne</label>
                  <QuillEditor 
                    value={internalNotes} 
                    onChange={setInternalNotes}
                  />

                  <div className="flex items-center justify-between mt-6 mb-2 border-b border-gray-300 pb-1.5">
                      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Riepilogo Simulatore</h4>
                      <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Totale: €{internalTotal.toFixed(2)}</span>
                  </div>

                  <table className="w-full mb-2">
                    <thead>
                        <tr className="text-xs text-left text-gray-700"><th>Qt.</th><th className="w-3/5">Descrizione</th><th className="w-1/5">Dettagli</th><th>Costo</th><th></th></tr>
                    </thead>
                    <tbody>
                        {internalRows.map((row, index) => (
                            <tr key={`${row.id}-${index}`}>
                                <td className="p-1"><input type="number" className="w-12 p-1 border border-gray-400 rounded bg-white" value={row.quantity || ''} onChange={e => updateInternalRow(row.id, 'quantity', parseFloat(e.target.value))} /></td>
                                <td className="p-1"><input className="w-full p-1 border border-gray-400 rounded bg-white" value={row.description} onChange={e => updateInternalRow(row.id, 'description', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full p-1 border border-gray-400 rounded bg-white" placeholder="Dettagli..." value={row.details || ''} onChange={e => updateInternalRow(row.id, 'details', e.target.value)} /></td>
                                <td className="p-1"><input type="number" className="w-20 p-1 border border-gray-400 rounded bg-white" value={row.cost || ''} onChange={e => updateInternalRow(row.id, 'cost', parseFloat(e.target.value))} /></td>
                                <td className="p-1">
                                    <button onClick={() => setInternalRows(internalRows.filter((_, i) => i !== index))} className="text-rose-600 hover:text-rose-800">
                                        <X size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                  </table>
                  <button onClick={addInternalRow} className="text-blue-800 text-sm mb-2 font-medium">+ Aggiungi Riga Interna</button>
                  <div className="text-right font-bold text-sm text-gray-900">Totale Costi: €{internalTotal.toFixed(2)}</div>
                </div>
            )}

            {activeTab === 'allegati' && (
                <div className="bg-gray-100 p-6 rounded-lg shadow-sm border border-gray-300 space-y-4">
                  <div className='flex justify-end mb-2'>
                      <button onClick={() => setActiveTab(null)} className="text-gray-700 hover:text-gray-900 text-sm cursor-pointer font-semibold bg-white border border-gray-300 px-3 py-1 rounded shadow-sm hover:bg-gray-50">Chiudi</button>
                  </div>
                  <h3 className="font-bold text-lg text-gray-950 mb-1 font-sans flex items-center gap-2">
                    <FolderOpen className="text-blue-700" size={22} />
                    <span>Gestione Allegati Preventivo</span>
                  </h3>
                  <p className="text-xs text-gray-650 leading-relaxed max-w-3xl">
                    Questo pannello ti consente di associare molteplici file PDF o collegamenti di rete locale (NAS) a questo preventivo. Puoi scegliere un file dal computer per copiare automaticamente il percorso consigliato negli appunti, oppure inserire manualmente qualsiasi percorso o indirizzo web.
                  </p>

                  <div className="bg-white p-5 rounded-lg border border-gray-300">
                    <div className="space-y-4">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b border-gray-200">
                        <div className="flex flex-col gap-1">
                          <h4 className="font-bold text-xs text-blue-800 uppercase tracking-wider flex items-center gap-2">
                            <Paperclip size={14} />
                            Gestione Allegati NAS ({attachmentsList.length})
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={handleConnectNas}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${isNasConnected ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200'}`}
                            >
                              <Settings size={12} />
                              <span>{isNasConnected ? "NAS ON" : "CONNETTI NAS"}</span>
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.multiple = true;
                              input.accept = 'application/pdf';
                              input.onchange = (e) => {
                                const files = (e.target as HTMLInputElement).files;
                                if (files) {
                                  const newPaths: string[] = [];
                                  const root = nasRootPath;
                                  for (let i = 0; i < files.length; i++) {
                                    const fileName = files[i].name;
                                    const fullPath = `${root}${fileName}`;
                                    if (!attachmentsList.includes(fullPath)) {
                                      newPaths.push(fullPath);
                                    }
                                  }
                                  if (newPaths.length > 0) {
                                    setAttachmentsList(prev => [...prev, ...newPaths]);
                                  }
                                }
                              };
                              input.click();
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                          >
                            <FileUp size={14} />
                            <span>Aggiungi File dal NAS...</span>
                          </button>
                          
                          {attachmentsList.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("Sei sicuro di voler rimuovere TUTTI gli allegati?")) {
                                  setAttachmentsList([]);
                                }
                              }}
                              className="text-[10px] font-bold text-red-600 hover:text-red-800 transition-colors cursor-pointer border border-red-200 px-2 py-1.5 rounded-lg"
                            >
                              Svuota tutto
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex flex-col md:flex-row gap-3 items-center">
                        <div className="flex-1 space-y-1 w-full">
                          <label className="text-[10px] font-bold text-blue-700 uppercase">Radice Percorso NAS predefinita</label>
                          <input 
                            type="text" 
                            placeholder="Es: \\NAS\Preventivi\"
                            className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-xs font-mono"
                            value={nasRootPath}
                            onChange={(e) => {
                              const newPath = e.target.value;
                              setNasRootPath(newPath);
                              localStorage.setItem('nas_root_path', newPath);
                            }}
                          />
                        </div>
                        <p className="text-[9px] text-blue-600 max-w-[200px] leading-tight italic">
                          Nota: I file non vengono caricati sul server. Salviamo solo il link per permetterti di ritrovarli sul NAS.
                        </p>
                      </div>

                        {attachmentsList.length > 0 ? (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                            {attachmentsList.map((pathStr, idx) => {
                              const isNas = isNasLinkPath(pathStr);
                              const filename = getFileNameFromPath(pathStr);
                              return (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg group hover:border-blue-300 transition-all">
                                  <div className={`p-2 bg-white rounded border border-gray-200 ${isNas ? 'text-purple-600' : 'text-red-600'}`}>
                                    {isNas ? <HardDrive size={18} /> : <FileText size={18} />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-gray-900 truncate">
                                      {filename}
                                    </p>
                                    <p className="text-[10px] text-gray-500 truncate font-mono">
                                      {pathStr}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleViewNasPdf(pathStr)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                                      title="Visualizza PDF"
                                    >
                                      <Eye size={14} />
                                      <span className="text-[9px] font-bold uppercase">Visualizza</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAttachmentsList(prev => prev.filter((_, i) => i !== idx));
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                      title="Rimuovi associazione"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                            <Paperclip size={32} className="mx-auto text-gray-300 mb-3" />
                            <p className="text-xs font-medium text-gray-500">Nessun allegato associato a questo preventivo.</p>
                            <p className="text-[10px] text-gray-400 mt-1">Usa il pulsante in alto per aggiungere file dal tuo NAS.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
            )}

        </div>
      </div>
        <div className="fixed bottom-0 left-0 w-full bg-gray-900 border-t border-gray-700 p-4 flex justify-between items-center shadow-lg px-6 text-white z-40">
          <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showTotal} 
                    onChange={e => setShowTotal(e.target.checked)} 
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                  />
                  Mostra totale nel PDF/Anteprima
              </label>
              {showTotal && (
                  <div className="text-xl font-bold ml-4">
                      Totale Preventivo: €{grandTotal.toFixed(2)}
                  </div>
              )}
          </div>
          <div className="flex gap-4 items-center">
              <button 
                onClick={generatePDF} 
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded font-bold disabled:opacity-50 cursor-pointer hover:bg-gray-700 transition-colors"
              >
                <FileText size={20} /> {isGeneratingPDF ? "Generazione PDF..." : "PDF"}
              </button>
              <button onClick={() => setShowPreview(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded font-bold cursor-pointer hover:bg-blue-800 transition-colors"><Eye size={20} /> Anteprima</button>
              
              <button 
                onClick={() => validateQuotation(true)} 
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded font-bold hover:bg-amber-700 transition-colors cursor-pointer"
                title="Convalida la correttezza dei dati inseriti"
              >
                Convalida del preventivo
              </button>

              <button 
                onClick={handleSave} 
                className="flex items-center justify-center w-10 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold shadow hover:shadow-lg transition-all cursor-pointer"
                title="Salva Preventivo nel Database"
              >
                <Save size={20} />
              </button>
          </div>
      </div>

      <PDFPreviewModal 
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          companyInfo={companyInfo}
          clientInfo={clientInfo}
          rows={rows.filter(r => !isRowEmpty(r))}
          quotationNumber={quotationNumber}
          quotationDate={quotationDate}
          grandTotal={grandTotal}
          notes={notes}
          condizioni={condizioni}
          showTotal={showTotal}
          trasporto={trasporto}
          installazione={installazione}
          collaudo={collaudo}
          validita={validita}
      />

      <ClientSelectorPopup 
        isOpen={showClientSelector} 
        onClose={() => setShowClientSelector(false)} 
        onSelect={(client) => { setClientInfo(client); setShowClientSelector(false); }} 
      />
      
      
      {/* Salva disabilitato */}
      {showPdfSaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] backdrop-blur-sm animate-fade-in">
          <div className="bg-white text-gray-900 rounded-xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText size={18} />
                <h3 className="font-bold text-base tracking-wide text-white">Salvataggio Documento PDF</h3>
              </div>
              <button 
                onClick={() => { setShowPdfSaveModal(false); setPendingPdfDoc(null); }}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Nome del file da salvare
                </label>
                <input 
                  type="text"
                  value={pdfFilename}
                  onChange={(e) => setPdfFilename(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-medium"
                  placeholder="Inserisci il nome del file..."
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <HelpCircle size={13} />
                  Come scegliere la cartella di salvataggio?
                </p>
                <p>
                  Per scegliere una cartella specifica sul tuo computer:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {typeof (window as any).showSaveFilePicker === 'function' && (
                    <li>Clicca su <b>"Sfoglia e Salva"</b> per aprire il selettore del sistema operativo.</li>
                  )}
                  <li>In alternativa, abilita l'opzione <b>"Chiedi dove salvare i file prima di scaricarli"</b> nelle impostazioni del tuo browser (Chrome, Edge, Firefox, ecc.).</li>
                </ul>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row justify-end gap-2 border-t border-gray-100">
              <button 
                onClick={() => { setShowPdfSaveModal(false); setPendingPdfDoc(null); }}
                className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors border border-gray-300 bg-white rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                Annulla
              </button>
              
              <button 
                onClick={() => handleSavePdfConfirmed(false)}
                className="px-4 py-2 text-sm font-semibold text-white bg-gray-600 hover:bg-gray-700 transition-colors rounded-lg flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                title="Salva direttamente nella cartella Download del browser"
              >
                <Download size={15} />
                <span>Download Standard</span>
              </button>

              {typeof (window as any).showSaveFilePicker === 'function' && (
                <button 
                  onClick={() => handleSavePdfConfirmed(true)}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-600 transition-colors rounded-lg flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  title="Consente di scegliere la cartella e il nome tramite il dialogo del sistema operativo"
                >
                  <FolderOpen size={15} />
                  <span>Sfoglia e Salva</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Popup Modal */}
      {activeViewerPath && (
        <PDFViewerModal 
          isOpen={!!activeViewerPath}
          onClose={() => setActiveViewerPath(null)}
          pdfPath={activeViewerPath}
        />
      )}
    </div>
  );
}

// PDF Viewer Modal component
interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfPath: string;
}

function PDFViewerModal({ isOpen, onClose, pdfPath }: PDFViewerModalProps) {
  if (!isOpen) return null;

  const isNas = isNasLinkPath(pdfPath);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-300 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden text-gray-950">
        {/* Header */}
        <div className="bg-gray-950 text-white px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Visualizzatore PDF Allegato</h3>
          <div className="flex gap-2">
            {!isNas && (
              <button
                onClick={() => window.open(pdfPath, '_blank')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-all cursor-pointer"
              >
                Apri in nuova scheda
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 font-bold text-xl leading-none cursor-pointer"
            >
              &times;
            </button>
          </div>
        </div>
        
        {/* Iframe or NAS copy panel content */}
        <div className="flex-1 bg-gray-50 relative flex flex-col">
          {isNas ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="p-4 bg-purple-100 rounded-full text-purple-600">
                <HardDrive size={48} />
              </div>
              <div className="max-w-md space-y-3">
                <h4 className="text-lg font-bold text-gray-900">Collegamento File su NAS / Rete</h4>
                <p className="text-sm text-gray-650">
                  Questo allegato è memorizzato localmente nella tua rete o sul NAS. Per motivi di sicurezza, i browser web non consentono di lanciare direttamente file di rete o cartelle locali.
                </p>
                <div className="text-xs text-gray-600 font-mono bg-gray-100 p-4 rounded-lg border border-gray-355 break-all select-all relative group">
                  <span className="block mb-1 text-[10px] uppercase text-gray-400 font-sans tracking-wider font-semibold">Percorso File:</span>
                  {pdfPath}
                </div>
                <p className="text-xs text-orange-600 font-bold">
                  Per visualizzare questo file, usa il tasto "Visualizza" nella lista allegati (richiede NAS connesso).
                </p>
              </div>
            </div>
          ) : (
            <iframe
              src={pdfPath}
              className="w-full h-full border-none"
              title="PDF Viewer"
            />
          )}
        </div>
      </div>
    </div>
  );
}

const convertPdfToImages = async (pdfDataUrl: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    if (!(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        startConversion(pdfjsLib, pdfDataUrl, resolve, reject);
      };
      script.onerror = (e) => reject(new Error('Failed to load PDF library.'));
      document.head.appendChild(script);
    } else {
      const pdfjsLib = (window as any).pdfjsLib;
      startConversion(pdfjsLib, pdfDataUrl, resolve, reject);
    }
  });
};

const startConversion = async (pdfjsLib: any, pdfDataUrl: string, resolve: any, reject: any) => {
  try {
    const base64Content = pdfDataUrl.split(',')[1];
    const raw = window.atob(base64Content);
    const rawLength = raw.length;
    const array = new Uint8Array(new ArrayBuffer(rawLength));
    for (let i = 0; i < rawLength; i++) {
      array[i] = raw.charCodeAt(i);
    }

    const loadingTask = pdfjsLib.getDocument({ data: array });
    const pdf = await loadingTask.promise;
    const images: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // high resolution
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.85));
    }

    resolve(images);
  } catch (error) {
    reject(error);
  }
};
