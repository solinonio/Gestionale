import React from 'react';
import { CompanyInfo, Client, QuotationRow } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyInfo: CompanyInfo;
  clientInfo: Client;
  rows: QuotationRow[];
  quotationNumber: string;
  quotationDate: string;
  grandTotal: number;
  notes: string;
  condizioni: string;
  attachment?: string;
  showTotal?: boolean;
  trasporto?: 'incluso' | 'a carico del cliente' | null;
  installazione?: 'inclusa' | 'da quantificare' | null;
  collaudo?: 'incluso' | 'non incluso' | null;
  validita?: string;
}

const renderFormattedDescription = (desc: string) => {
  if (!desc) return '';
  
  // Normalize <b> and <strong> to **
  let clean = desc
    .replace(/<\/?strong>/gi, '**')
    .replace(/<\/?b>/gi, '**');
  
  const parts = clean.split('**');
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} className="font-bold text-gray-950">{part}</strong>;
    }
    return part;
  });
};

export default function PDFPreviewModal({ 
  isOpen, 
  onClose, 
  companyInfo, 
  clientInfo, 
  rows, 
  quotationNumber, 
  quotationDate, 
  grandTotal, 
  notes, 
  condizioni, 
  attachment, 
  showTotal = true,
  trasporto,
  installazione,
  collaudo,
  validita
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-8 rounded shadow-xl w-full max-w-2xl h-5/6 overflow-y-auto text-gray-900">
        <div className="flex justify-between items-center mb-6 border-b pb-4 border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Anteprima PDF</h2>
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors rounded font-medium">Chiudi</button>
        </div>
        
        <div className="border border-gray-300 bg-white p-8 text-sm text-gray-900 rounded shadow-inner">
          {/* Header */}
          <div className="flex justify-between mb-8 gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{companyInfo.name}</h1>
              <p className="font-bold mt-2 text-gray-800">Sede Operativa:</p>
              <p className="text-gray-700">{companyInfo.address}</p>
              <p className="text-gray-700">{companyInfo.cap} {companyInfo.city}</p>
              <p className="text-gray-700"><b className="text-gray-900">P.IVA:</b> {companyInfo.vatNumber} <b className="text-gray-900">Cod. Univ.:</b> {companyInfo.sdiCode}</p>
              <p className="text-gray-700">{companyInfo.email}</p>
            </div>
            <div className="text-right flex-1">
              <h2 className="font-bold border-b border-gray-400 text-gray-900 pb-1 mb-2">SPETTABILE</h2>
              <p className="font-bold text-gray-900">
                {(() => {
                  const name = (clientInfo.name || '').trim();
                  const intestazione = (clientInfo.intestazione || '').trim();
                  if (intestazione && name && intestazione !== name) {
                    return `${intestazione} - ${name}`;
                  }
                  return name || intestazione || '';
                })()}
              </p>
              <p className="text-gray-700">{clientInfo.address}</p>
              <p className="text-gray-700">{clientInfo.cap} {clientInfo.city}</p>
              <p className="text-gray-700"><b className="text-gray-900">P.IVA:</b> {clientInfo.vatNumber}</p>
            </div>
          </div>

          <div className="mb-8 font-bold text-gray-900 border-y py-2 border-gray-200">
            <p>Prev. N° : {quotationNumber} &nbsp;&nbsp;&nbsp;&nbsp; Del : {quotationDate.split('-').reverse().join('/')}</p>
          </div>

          {/* Table */}
          <table className="w-full mb-8 border-collapse text-gray-900">
            <thead>
              <tr className="bg-gray-100 text-gray-800 border-b border-gray-300">
                <th className="border border-gray-300 p-2 text-left font-bold">Q.tà</th>
                <th className="border border-gray-300 p-2 text-left font-bold">DESCRIZIONE</th>
                <th className="border border-gray-300 p-2 text-right font-bold">PREZZO</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isMain = !row.isDescriptionOnly;
                const formattedDesc = row.isDescriptionOnly 
                  ? (row.description || '') 
                  : (row.description || '').toUpperCase();
                
                const pBase = (row.price === undefined || row.price === null || isNaN(row.price)) ? 0 : row.price;
                const disc = (row.discount === undefined || row.discount === null || isNaN(row.discount)) ? 0 : row.discount;
                const discountedPrice = pBase * (1 - disc / 100);

                return (
                  <tr key={`${row.id}-${i}`} className={`${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'} ${isMain ? 'font-bold text-gray-950' : 'font-normal text-gray-700'}`}>
                    <td className="border border-gray-300 p-2 text-gray-800">
                      {row.quantity === undefined || row.quantity === null || isNaN(row.quantity) ? '' : row.quantity}
                    </td>
                    <td className={`border border-gray-300 p-2 whitespace-pre-wrap ${isMain ? 'uppercase font-bold text-gray-950' : 'font-normal text-gray-700'}`}>
                      {row.isDescriptionOnly ? (
                        <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: row.description || '' }} />
                      ) : (
                        renderFormattedDescription(formattedDesc)
                      )}
                    </td>
                    <td className="border border-gray-300 p-2 text-right text-gray-800">
                      {row.isOmaggio ? (
                        <span className="text-green-700 font-bold">Omaggio</span>
                      ) : (
                        row.isDescriptionOnly ? '' : (
                          <div className="flex flex-col items-end">
                            <span>€ {pBase.toFixed(2)}</span>
                            {disc > 0 && (
                              <span className="text-xs text-rose-600 font-bold mt-0.5">
                                (-{disc}%) € {discountedPrice.toFixed(2)}
                              </span>
                            )}
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {showTotal && (
            <div className="bg-gray-100 border border-gray-300 p-3 text-right font-bold mb-6 text-gray-900 text-base rounded">
              Totale: € {grandTotal.toFixed(2)}
            </div>
          )}

          {/* Dettagli Fornitura */}
          {(trasporto || installazione || collaudo || validita) && (
            <div className="mb-6 text-xs md:text-sm border-t pt-4 border-gray-300 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded">
              <div>
                <p className="font-bold text-gray-900 mb-1">Dettagli Fornitura:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  {trasporto && (
                    <li>Trasporto: <span className="font-semibold uppercase">{trasporto}</span></li>
                  )}
                  {installazione && (
                    <li>Installazione: <span className="font-semibold uppercase">{installazione}</span></li>
                  )}
                  {collaudo && (
                    <li>Collaudo: <span className="font-semibold uppercase">{collaudo}</span></li>
                  )}
                </ul>
              </div>
              {validita && (
                <div>
                  <p className="font-bold text-gray-900 mb-1">Validità Preventivo:</p>
                  <p className="text-gray-700 font-semibold uppercase">{validita}</p>
                </div>
              )}
            </div>
          )}
          
          {/* Notes */}
          {notes && (
              <div className="mb-4 text-sm border-t pt-4 border-gray-200">
                  <p className="font-bold text-gray-900 mb-1">Note:</p>
                  <div className="text-gray-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: notes }} />
              </div>
          )}

          {/* Attachment */}
          {attachment && (
              <div className="mt-8 border-t pt-4 border-gray-200">
                  <p className="font-bold text-gray-900 mb-2">Allegato:</p>
                  {attachment.startsWith('data:application/pdf') ? (
                      <div className="bg-gray-100 p-4 rounded text-center">
                          <p className="text-gray-700 font-medium">Documento PDF allegato</p>
                          <a href={attachment} download="allegato.pdf" className="text-blue-700 underline">Scarica PDF</a>
                      </div>
                  ) : (
                      <img src={attachment} alt="Allegato" className="max-w-full rounded shadow" />
                  )}
              </div>
          )}

          {/* Footer */}
          <div className="mt-auto">
          </div>
        </div>
      </div>
    </div>
  );
}
