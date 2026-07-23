export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  type: 'major' | 'minor' | 'patch';
  changes: {
    category: 'feature' | 'improvement' | 'bugfix';
    text: string;
  }[];
}

export const changelogData: ChangelogEntry[] = [
  {
    version: "3.5.2",
    date: "2026-07-23",
    title: "Gestionale v3.5.2 - Raffinamento Interfaccia Laser",
    type: "patch",
    changes: [
      {
        category: "improvement",
        text: "Tabella Colori Laser: Riportati tutti i parametri (Velocità, Potenza, Modalità, DPI, PPI) su una singola riga orizzontale per una consultazione più rapida."
      },
      {
        category: "improvement",
        text: "Sincronizzazione Parametri: Rimossi i selettori ridondanti nella tabella colori; i parametri Modalità, DPI e PPI vengono ora ereditati direttamente dalle impostazioni principali del materiale."
      },
      {
        category: "improvement",
        text: "Dimensionamento Scheda: Ampliata ulteriormente la larghezza della scheda lavorazione (max-w-[84rem]) per una visualizzazione ottimale dei dati tecnici."
      }
    ]
  },
  {
    version: "3.5.1",
    date: "2026-07-23",
    title: "Gestionale v3.5.1 - Ottimizzazione Spazi e Leggibilità",
    type: "patch",
    changes: [
      {
        category: "improvement",
        text: "Layout Laser: Riequilibrata la scheda lavorazione laser, aumentando lo spazio dedicato ai colori associati e riducendo la sezione materiale del 10% per una visualizzazione più ampia."
      },
      {
        category: "improvement",
        text: "Tipografia Laser: Aumentata la dimensione dei caratteri e delle etichette nella tabella colori per facilitare la lettura e l'inserimento dei parametri tecnici."
      }
    ]
  },
  {
    version: "3.5.0",
    date: "2026-07-23",
    title: "Gestionale v3.5.0 - UX Laser Ottimizzata",
    type: "minor",
    changes: [
      {
        category: "improvement",
        text: "Design Colori Laser: Riprogettata l'impaginazione della tabella colori associati per una migliore leggibilità. I parametri specifici per X252 (Modalità, DPI, PPI) sono stati raggruppati in un layout multi-riga più chiaro."
      },
      {
        category: "improvement",
        text: "Interfaccia Utente: Ottimizzati gli spazi e le etichette nella scheda lavorazione per facilitare l'inserimento dei dati tecnici."
      }
    ]
  },
  {
    version: "3.4.0",
    date: "2026-07-23",
    title: "Gestionale v3.4.0 - Parametri Laser Avanzati e Automazione NAS",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Lavorazioni Laser (X252): Aggiunta la gestione granulare per colore di Modalità, DPI e PPI. I valori vengono ora memorizzati e richiamati correttamente per ogni singola riga colore."
      },
      {
        category: "improvement",
        text: "Automazione NAS: Ottimizzato il flusso di selezione cartelle NAS. Ora il percorso viene riportato e memorizzato automaticamente come 'Radice Percorso NAS predefinita' senza passaggi manuali aggiuntivi."
      },
      {
        category: "improvement",
        text: "Gestione Allegati: Corretto il rilevamento del percorso esatto durante l'associazione dei file dal volume di rete."
      }
    ]
  },
  {
    version: "3.2.2",
    date: "2026-07-17",
    title: "Gestionale v3.2.2 - Nuova Repository GitHub di Default",
    type: "patch",
    changes: [
      {
        category: "improvement",
        text: "Aggiornata la repository GitHub di default per gli aggiornamenti software a 'solinonio/Gestionale'."
      },
      {
        category: "improvement",
        text: "Ottimizzati i parametri di sistema per riflettere il nuovo percorso della repository."
      }
    ]
  },
  {
    version: "3.2.1",
    date: "2026-07-17",
    title: "Gestionale v3.2.1 - Sicurezza e Streaming File NAS",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Implementato streaming PDF diretto e sicuro dal volume NAS (/Volumes/NAS/)."
      },
      {
        category: "improvement",
        text: "Aggiunto controllo preventivo per evitare attacchi di tipo Path Traversal sui percorsi dei file."
      },
      {
        category: "improvement",
        text: "Aggiornato il codice per visualizzare ed allineare correttamente il numero di versione 3.2.1 nell'interfaccia utente."
      }
    ]
  },
  {
    version: "3.19.0",
    date: "2026-07-17",
    title: "Gestionale v3.19.0 - Semplificazione Allegati e Collegamento NAS Automatico",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Nuovo flusso di associazione PDF: selezionando un file locale, il sistema calcola, mostra e copia negli appunti automaticamente il percorso di rete locale (NAS)."
      },
      {
        category: "feature",
        text: "Pulsante di conferma dedicato per incollare e associare definitivamente il percorso di rete locale salvando solo il link testuale nel database."
      },
      {
        category: "improvement",
        text: "Interfaccia utente ridisegnata per la scheda 'Allegati Preventivo', con passaggi numerati chiari e stato corrente dell'allegato."
      }
    ]
  },
  {
    version: "3.18.0",
    date: "2026-07-17",
    title: "Gestionale v3.18.0 - Forzatura Progressivo e Modifica Totale Preventivo",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Introdotta la possibilità di forzare manualmente il progressivo dei preventivi (N°), permettendo di inserire qualsiasi numero saltando il controllo di auto-incremento automatico."
      },
      {
        category: "feature",
        text: "Aggiunta la possibilità di modificare manualmente il totale complessivo del preventivo direttamente dalla scheda 'Preventivo', mantenendo la flessibilità di sovrascrivere il calcolo automatico."
      },
      {
        category: "improvement",
        text: "Migliorato l'aspetto visivo dei comandi e delle etichette di stato per il totale personalizzato e per la forzatura del progressivo dei preventivi."
      }
    ]
  },
  {
    version: "3.11.0",
    date: "2026-07-16",
    title: "Gestionale v3.11.0 - Nuovo Catalogo Materiali Condivisi",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Creata la nuova pagina dedicata 'Materiali' con tabelle interattive per l'inserimento, la modifica e l'eliminazione dei materiali condivisi."
      },
      {
        category: "feature",
        text: "Introdotta una nuova scheda di immissione materiale prima della tabella con slider di precisione per la regolazione di Lunghezza (0-3500 mm), Larghezza (0-3500 mm) e Spessore (0-100 mm)."
      },
      {
        category: "feature",
        text: "Aggiunti nuovi campi specifici per ciascun materiale: Link al sito del produttore, Fornitore associato e Prezzo/Costo della lastra."
      }
    ]
  },
  {
    version: "3.10.0",
    date: "2026-07-13",
    title: "Gestionale v3.10.0 - Filtri per Anno in Dashboard e Associazione Preventivi/XML",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Introdotto il filtro per anno per le statistiche della Dashboard. Ora è possibile selezionare e visualizzare il fatturato totale (Fatture XML) e il totale dei preventivi generati per ciascun anno o vederne il totale complessivo."
      },
      {
        category: "feature",
        text: "Implementato l'abbinamento intelligente tra le fatture XML e i preventivi emessi. Il sistema permette di selezionare un preventivo emesso per lo stesso cliente e segnala visivamente se gli importi coincidono perfettamente o differiscono."
      },
      {
        category: "improvement",
        text: "Migliorato il design delle card statistiche della Dashboard con selettori dropdown integrati e testi di riepilogo dinamici e dettagliati."
      }
    ]
  },
  {
    version: "3.2.0",
    date: "2026-07-09",
    title: "Gestionale v3.2.0 - Gestione Multi-Allegati e Generazione Preventivi",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Gestione multi-allegato PDF per ogni cliente in una comoda tabella integrata in Anagrafiche."
      },
      {
        category: "feature",
        text: "Generazione automatica di un preventivo ad-hoc compilando Data, Progressivo e Importo del PDF caricato."
      }
    ]
  },
  {
    version: "3.1.7",
    date: "2026-07-09",
    title: "Gestionale v3.1.7 - Semplificazione Allegati Preventivi",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Rimossi campi superflui (data, progressivo, importo) dalla scheda allegati nei preventivi."
      }
    ]
  },
  {
    version: "3.1.3",
    date: "2026-07-08",
    title: "Gestionale v3.1.3 - Log Viewer e Correzione Allegati",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Aggiunto Log Viewer per monitorare in tempo reale i log di sistema."
      },
      {
        category: "bugfix",
        text: "Risolto errore nel recupero degli allegati in Anagrafica e nei Preventivi."
      }
    ]
  },
  {
    version: "3.1.2",
    date: "2026-07-08",
    title: "Gestionale v3.1.2 - Risoluzione errori salvataggio allegati in Anagrafica",
    type: "patch",
    changes: [
      {
        category: "bugfix",
        text: "Migliorata la gestione degli errori durante il salvataggio degli allegati in Anagrafica per risolvere i problemi di persistenza."
      }
    ]
  },
  {
    version: "3.1.1",
    date: "2026-07-08",
    title: "Gestionale v3.1.1 - Risoluzione errori caricamento PDF",
    type: "patch",
    changes: [
      {
        category: "bugfix",
        text: "Risolti i problemi di salvataggio preventivi (Payload Too Large) e caricamento allegati in Anagrafica attraverso l'implementazione di una nuova strategia di archiviazione file."
      },
      {
        category: "improvement",
        text: "Introdotto limite di 2MB per il caricamento dei file PDF per ottimizzare le prestazioni e la stabilità."
      }
    ]
  },
  {
    version: "3.1.0",
    date: "2026-07-08",
    title: "Gestionale v3.1.0 - Importazione Preventivi PDF e Nuova Scheda Preventivi",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Rinominata la scheda 'Altro' di PaginaAnagrafiche in 'Preventivi', raggruppando ordinatamente tutti i preventivi legati al cliente selezionato."
      },
      {
        category: "feature",
        text: "Introdotto il pulsante 'Importa PDF' che consente di caricare vecchi preventivi esterni o documenti PDF storici direttamente nella scheda del cliente."
      },
      {
        category: "feature",
        text: "Aggiunto supporto per associare Data, Importo e Numero di Riferimento ai preventivi PDF importati, considerandoli ed elencandoli pienamente a fianco dei preventivi nativi."
      },
      {
        category: "improvement",
        text: "Creata un'interfaccia interattiva per visualizzare, scaricare il PDF originale, modificare le informazioni o eliminare sia i preventivi nativi che quelli importati."
      }
    ]
  },
  {
    version: "3.0.6",
    date: "2026-07-08",
    title: "Gestionale v3.0.6 - Formattazione Righe Secondarie e Menu d'Elenco",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Introdotto il menu di formattazione rapida per le righe di descrizione secondarie (Grassetto, Elenco Puntato, MAIUSCOLO, minuscolo, Iniziali Maiuscole)."
      },
      {
        category: "improvement",
        text: "Sbloccata la formattazione e la conservazione del casing per le descrizioni secondarie, rimuovendo la conversione automatica forzata a minuscolo sia a schermo che sul PDF generato."
      }
    ]
  },
  {
    version: "3.0.5",
    date: "2026-07-08",
    title: "Gestionale v3.0.5 - Opzioni Spedizione, Installazione e Collaudo",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Aggiunte checkbox per la gestione del Trasporto (incluso / a carico del cliente), dell'Installazione (inclusa / da quantificare) e del Collaudo (incluso / non incluso)."
      },
      {
        category: "feature",
        text: "Aggiunto campo di validità del preventivo con valore predefinito impostato a '15 GG'."
      },
      {
        category: "improvement",
        text: "Integrazione delle nuove opzioni di fornitura nell'anteprima e nel PDF esportato."
      }
    ]
  },
  {
    version: "3.0.4",
    date: "2026-07-08",
    title: "Gestionale v3.0.4 - Sconto e Formattazione Righe Intelligente",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Introdotto il campo Sconto % per riga. Quando applicato, calcola in tempo reale il prezzo unitario scontato e aggiorna riga, totale e PDF."
      },
      {
        category: "improvement",
        text: "Adattamento automatico dell'altezza delle righe di descrizione (grazie a textarea multi-riga reattive)."
      },
      {
        category: "improvement",
        text: "Formattazione intelligente delle descrizioni: le righe principali (con quantità) sono visualizzate in MAIUSCOLO e grassetto, mentre le righe secondarie (senza quantità) sono in minuscolo e carattere normale."
      }
    ]
  },
  {
    version: "3.0.3",
    date: "2026-07-08",
    title: "Gestionale v3.0.3 - Pulizia Automatica e Gestione Righe Vuote",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Introdotta l'eliminazione manuale ed automatica delle righe vuote o indesiderate direttamente dalla Scheda Preventivo."
      },
      {
        category: "improvement",
        text: "Ottimizzata la generazione dei PDF e l'anteprima escludendo in tempo reale qualsiasi riga priva di contenuto."
      }
    ]
  },
  {
    version: "3.0.2",
    date: "2026-07-08",
    title: "Gestionale v3.0.2 - Azioni Rapide Preventivi ed Estensione Anni Selezione",
    type: "patch",
    changes: [
      {
        category: "improvement",
        text: "Migliorata la visibilità delle azioni di duplicazione ed eliminazione nella tabella dei preventivi inserendo pulsanti più chiari ed espliciti."
      },
      {
        category: "improvement",
        text: "Esteso l'intervallo temporale di selezione degli anni nella scheda preventivo per consentire la scelta tra gli anni dal 2020 al 2030."
      }
    ]
  },
  {
    version: "3.0.1",
    date: "2026-07-08",
    title: "Gestionale v3.0.1 - Rimozione Importazione PDF ed Ottimizzazione Compatibilità",
    type: "patch",
    changes: [
      {
        category: "improvement",
        text: "Rimossa l'opzione di importazione automatica dei vecchi PDF dalla scheda preventivo per snellire e semplificare l'interfaccia utente."
      },
      {
        category: "bugfix",
        text: "Migliorata la compatibilità della gestione degli allegati PDF e del download dei documenti con i browser Safari e Firefox."
      }
    ]
  },
  {
    version: "3.0.0",
    date: "2026-07-07",
    title: "Gestionale v3.0.0 - Versione Maggiore con IA e Bug Fixes",
    type: "major",
    changes: [
      {
        category: "feature",
        text: "Importazione intelligente di vecchi preventivi PDF con compilazione automatica tramite Intelligenza Artificiale (Gemini)."
      },
      {
        category: "bugfix",
        text: "Risolto bug nel salvataggio dei preventivi con lettere (es. 15/A): ora vengono salvati e ricaricati correttamente senza generare conflitti di duplicati."
      },
      {
        category: "improvement",
        text: "Ottimizzazione delle icone per le azioni di download ed esportazione dei file PDF."
      }
    ]
  },
  {
    version: "2.9.9",
    date: "2026-07-07",
    title: "Gestionale v2.9.9 - Importazione PDF e miglioramenti UI",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Aggiunto pulsante per aggiungere nuovi preventivi."
      },
      {
        category: "improvement",
        text: "Aggiornate icone per tutte le azioni di salvataggio PDF."
      }
    ]
  },
  {
    version: "2.9.8",
    date: "2026-07-07",
    title: "Gestionale v2.9.8 - Miglioramento download file progetto",
    type: "minor",
    changes: [
      {
        category: "improvement",
        text: "Modificato il comportamento di apertura file progetto: ora viene suggerito il download, permettendo l'apertura con il programma predefinito del sistema operativo."
      }
    ]
  },
  {
    version: "2.9.7",
    date: "2026-07-06",
    title: "Gestionale v2.9.3 - Ottimizzazione UI Scheda Lavorazione",
    type: "minor",
    changes: [
      {
        category: "improvement",
        text: "Ottimizzazione Scheda Lavorazione: Il tempo di lavorazione è ora in formato orario (hh:mm). I controlli principali (Nome, Orario, Preferiti) sono stati riorganizzati nella parte superiore per una migliore fruibilità."
      }
    ]
  },
  {
    version: "2.9.1",
    date: "2026-07-06",
    title: "Gestionale v2.9.1 - Gestione Multipla Colori Avanzata",
    type: "minor",
    changes: [
      {
        category: "improvement",
        text: "Gestione Multipla Colori: Ottimizzata la logica di assegnazione. È ora possibile assegnare lo stesso colore sia come RASTER che come VECTOR, con un limite massimo di 2 righe per colore."
      }
    ]
  },
  {
    version: "2.9.0",
    date: "2026-07-06",
    title: "Gestionale v2.9 - Gestione Multipla Colori",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Gestione Multipla Colori: È ora possibile utilizzare lo stesso colore per RASTER e VECTOR separatamente nella stessa lavorazione, cliccando sull'icona del colore."
      }
    ]
  },
  {
    version: "2.8.0",
    date: "2026-07-06",
    title: "Gestionale v2.8 - Ottimizzazione UI e nuovi parametri laser",
    type: "minor",
    changes: [
      {
        category: "improvement",
        text: "Scheda Lavorazione Laser: Velocità ora è un campo numerico. La barra Passaggi è stata ridotta in orizzontale per ottimizzare lo spazio."
      },
      {
        category: "feature",
        text: "Nuovi parametri configurazione: Aggiunti menu a tendina per MODALITA (BLACK&WHITE, MANUAL COLOR, 3D MODE, STAMP MODE) e DPI (125-1000), e campo numerico per PPI."
      }
    ]
  },
  {
    version: "2.7.0",
    date: "2026-07-06",
    title: "Gestionale v2.7 - Ottimizzazione Assegnazione Colori",
    type: "minor",
    changes: [
      {
        category: "improvement",
        text: "Assegnazione Colori Intelligente: Cliccando sull'icona di un colore, il sistema ora aggiorna automaticamente i parametri (velocità, potenza, passaggi, frequenza) di una riga esistente se il colore è già presente, o ne crea una nuova."
      }
    ]
  },
  {
    version: "2.6.0",
    date: "2026-07-06",
    title: "Gestionale v2.6 - UI Refinements e Ottimizzazioni",
    type: "minor",
    changes: [
      {
        category: "improvement",
        text: "Ottimizzazione UI: Migliorato il contrasto visivo degli slider Potenza e Passaggi nella scheda Lavorazione Laser per una migliore leggibilità."
      },
      {
        category: "improvement",
        text: "Gestione Spazio Scheda Lavorazione: Revert delle modifiche alle dimensioni delle aree di testo per mantenere un layout più compatto e ordinato."
      },
      {
        category: "improvement",
        text: "Visibilità Condizionale Colonne: La colonna Frequenza nella scheda Colori Laser Associati viene ora visualizzata solo se il tipo di laser è impostato su 'Fibra'."
      }
    ]
  },
  {
    version: "2.4.0",
    date: "2026-07-06",
    title: "Gestionale v2.4 - Fix Slider Potenza e Selezione Colori Dinamica",
    type: "minor",
    changes: [
      {
        category: "bugfix",
        text: "Risolto malfunzionamento slider Potenza nella scheda Lavorazione Laser."
      },
      {
        category: "improvement",
        text: "Interfaccia Aggiunta Colori: Sostituito il pulsante di aggiunta con un menu a tendina dinamico per selezionare e aggiungere rapidamente i colori alla scheda lavorazione."
      }
    ]
  },
  {
    version: "2.3.0",
    date: "2026-07-06",
    title: "Gestionale v2.3 - Integrazione Colori Laser nella Scheda Lavorazione",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Integrazione Colori nella Scheda Lavorazione: La tabella di associazione dei colori (RASTER / VECTOR) è stata integrata direttamente all'interno della singola Scheda Lavorazione del materiale, eliminando la sezione globale separata."
      },
      {
        category: "improvement",
        text: "Layout Scheda Lavorazione Allargato: La finestra modale della scheda lavorazione è stata allargata orizzontalmente (max-w-5xl) per disporre le informazioni principali e la tabella colori affiancate, ottimizzando lo spazio a video."
      },
      {
        category: "improvement",
        text: "Interfaccia Colori Semplificata: Rimossi i campi testuali per i nomi dei colori e i codici RGB visibili, mantenendo solo il campione colore visivo dinamico e il codice esadecimale compatto."
      },
      {
        category: "feature",
        text: "Associazione Colori Multipla per Materiale: Possibilità di associare una o più righe colore specifiche direttamente all'interno del singolo materiale, con indicazione visiva dei colori associati direttamente nella tabella principale dei materiali."
      }
    ]
  },
  {
    version: "2.2.0",
    date: "2026-07-06",
    title: "Gestionale v2.2 - Associazione Colori Laser RASTER / VECTOR",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Tabella Associazione Colori Laser: Introdotta la nuova tabella di configurazione in fondo alla pagina 'Lavorazione Laser' con supporto per colonne RASTER, VECTOR, e menu a tendina con colore RGB accoppiato."
      },
      {
        category: "improvement",
        text: "Aggiunta e Rimozione Righe Dinamica: Possibilità di aggiungere nuove righe colore o rimuovere quelle esistenti con salvataggio immediato e persistenza nel database."
      }
    ]
  },
  {
    version: "2.1.0",
    date: "2026-07-06",
    title: "Gestionale v2.1 - Interfaccia Header e Flusso di Login",
    type: "minor",
    changes: [
      {
        category: "improvement",
        text: "Flusso di Login Ottimizzato: Dopo aver completato con successo l'accesso, l'applicazione reindirizza automaticamente l'utente direttamente alla schermata Home principale."
      },
      {
        category: "improvement",
        text: "Riorganizzazione Layout Header: Il pulsante Accedi e la visualizzazione del nome utente corrente (con relativo pulsante di disconnessione) sono stati posizionati strategicamente prima del pulsante Spegni Server per un flusso d'uso più logico."
      },
      {
        category: "feature",
        text: "Verifica dello Stato di Connessione: Introdotte nuove icone colorate e dinamiche (Rete NAS e Database) integrate nella barra del menu del database per un riscontro visivo immediato dello stato della connessione."
      }
    ]
  },
  {
    version: "2.0.0",
    date: "2026-07-06",
    title: "Gestionale v2.0 - Sicurezza, Ruoli e Tracciabilità",
    type: "major",
    changes: [
      {
        category: "feature",
        text: "Gestione Utenti Multiruolo: Introdotta l'interfaccia di amministrazione per la creazione e la rimozione di account utenti con ruoli personalizzati (Amministratore o Collaboratore)."
      },
      {
        category: "feature",
        text: "Controllo degli Accessi (Gating): Protezione avanzata delle schede Preventivi e Anagrafiche. Solo gli account con ruolo Amministratore possono accedervi, mentre i Collaboratori hanno accesso esclusivamente alla Dashboard e alla Lavorazione Laser."
      },
      {
        category: "feature",
        text: "Tracciamento delle Modifiche Laser: Ogni configurazione di lavorazione laser ora registra e mostra chiaramente il nome dell'utente che ha apportato l'ultima modifica."
      },
      {
        category: "feature",
        text: "Eliminazione Clienti: Abilitata la rimozione sicura di clienti dall'anagrafica tramite una comoda finestra modale di conferma."
      }
    ]
  },
  {
    version: "1.9.1",
    date: "2026-07-06",
    title: "Supporto PDF Multipagina per gli Allegati dei Preventivi",
    type: "patch",
    changes: [
      {
        category: "bugfix",
        text: "Integrazione Allegati PDF: Risolto l'errore di mancato supporto per gli allegati PDF nella generazione del PDF finale dei preventivi. Ora i file PDF allegati vengono convertiti dinamicamente e incorporati come pagine ad alta risoluzione all'interno del documento generato."
      },
      {
        category: "improvement",
        text: "Feedback Visivo di Generazione: Aggiunto lo stato di caricamento ('Generazione PDF...') sul pulsante di download del PDF per informare l'utente durante la conversione e l'unione dei documenti."
      }
    ]
  },
  {
    version: "1.9.0",
    date: "2026-07-06",
    title: "Interattività Clienti e Compatibilità Safari",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Paginazione Clienti: La tabella clienti nella Dashboard ora mostra 5 risultati per volta con comodi pulsanti di navigazione."
      },
      {
        category: "feature",
        text: "Schede Clienti Interattive: Cliccando su un cliente nella Dashboard, verrai reindirizzato direttamente alla sua anagrafica specifica."
      },
      {
        category: "bugfix",
        text: "Compatibilità Safari: Risolto il bug di avvio (schermata bianca) su Safari / WebKit causato dalle restrizioni di sicurezza di localStorage all'interno dell'iframe introducendo dei wrapper sicuri."
      }
    ]
  },
  {
    version: "1.8.0",
    date: "2026-07-05",
    title: "Ottimizzazioni UI e Simulatore",
    type: "patch",
    changes: [
      {
        category: "improvement",
        text: "Lavorazioni Laser: Revisione completa navigazione tab per una migliore responsività."
      },
      {
        category: "improvement",
        text: "Simulatore Preventivi: Layout ottimizzato per una migliore fruibilità su desktop."
      }
    ]
  },
  {
    version: "1.7.0",
    date: "2026-07-05",
    title: "Miglioramenti Dashboard e Preventivi",
    type: "patch",
    changes: [
      {
        category: "improvement",
        text: "Dashboard Preventivi: Aggiunta visualizzazione Intestazione e Totale Preventivo."
      },
      {
        category: "improvement",
        text: "Lavorazioni Laser: Ottimizzazione interfaccia ricerca e rimozione scrollbar dal menu tab."
      }
    ]
  },
  {
    version: "1.6.0",
    date: "2026-07-05",
    title: "Miglioramenti UI e Simulatore",
    type: "patch",
    changes: [
      {
        category: "improvement",
        text: "Dashboard: Rimozione barre di scorrimento verticali e colonne inutili nella tabella preventivi."
      },
      {
        category: "feature",
        text: "Simulatore: Aggiornamento interfaccia con slider per un calcolo rapido dei costi."
      }
    ]
  },
  {
    version: "1.5.0",
    date: "2026-07-05",
    title: "PHECDA, Allegati PDF e Miglioramenti UI",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "PHECDA: Label corretta in tutti i menu e icone specifiche per tipologia laser (CO2, Fibra, Diodo)."
      },
      {
        category: "feature",
        text: "Allegati: Possibilità di allegare immagini ai preventivi, visualizzazione icona in tabella e inclusione nel PDF finale."
      },
      {
        category: "improvement",
        text: "UI: Rimossa barra di scorrimento verticale superflua nel pannello lavorazione laser."
      }
    ]
  },
  {
    version: "1.4.4",
    date: "2026-07-05",
    title: "Supporto Allegati e Miglioramenti Laser",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Nuovo Laser: Aggiunto ELEGOO PHECDA associato a Lightburn."
      },
      {
        category: "feature",
        text: "Allegati Preventivo: Possibilità di aggiungere immagini come allegati al preventivo, inclusi in una pagina dedicata nel PDF."
      },
      {
        category: "improvement",
        text: "PDF: Aggiunta numerazione pagine e supporto per salvataggio locale tramite browser."
      }
    ]
  },
  {
    version: "1.4.2",
    date: "2026-07-05",
    title: "Blocco Associazione Software e Regole Laser Rigide",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Associazione Software Bloccata: Vincolato l'uso dei software di controllo in modo rigido in base alla macchina laser selezionata: SCA Laser per X252, EZCAD per Fibra, e Lightburn per Prometheo. I selettori radio sono stati resi di sola lettura per evitare configurazioni errate."
      },
      {
        category: "improvement",
        text: "Inizializzazione Nuovi Materiali: Quando viene aggiunto un nuovo materiale, il software viene automaticamente preimpostato in modo corretto a seconda della categoria attiva (es. SCA Laser se in X252, ecc.)."
      }
    ]
  },
  {
    version: "1.4.1",
    date: "2026-07-05",
    title: "Navigazione Unificata e Integrazione Laser X252",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Tab Unificata 'Tutti': Aggiunta una vista combinata per mostrare le configurazioni di tutti i modelli laser contemporaneamente, con badge colorati per identificare istantaneamente la macchina di origine."
      },
      {
        category: "improvement",
        text: "Incisore X252: Rinominata e configurata la macchina X352 in X252, allineando l'interfaccia e mantenendo la compatibilità con i salvataggi preesistenti."
      },
      {
        category: "improvement",
        text: "Schede Adattive nel Modale: Nella vista 'Tutti', i dettagli di ciascun materiale vengono aperti in una scheda adattiva che mostra o nasconde i parametri specifici (come la frequenza per la fibra) in base alla macchina reale del materiale."
      }
    ]
  },
  {
    version: "1.4.0",
    date: "2026-07-05",
    title: "Ottimizzazione Scheda Lavorazione e Filtri di Controllo",
    type: "minor",
    changes: [
      {
        category: "improvement",
        text: "Dimensione Potenza: Ridotta del 50% la larghezza del campo della potenza nella scheda di lavorazione, rendendo l'interfaccia più compatta ed elegante."
      },
      {
        category: "improvement",
        text: "Software di Controllo: Rimosso il selettore radio 'Nessuno' ridondante, offrendo un'esperienza diretta per scegliere solo tra i software attivi (Lightburn, SCA Laser, EZCAD) in una griglia ordinata a 3 colonne."
      },
      {
        category: "improvement",
        text: "Filtri Sempre Affiancati: Nella pagina principale, i filtri del software e le scorciatoie dei materiali più usati sono ora vincolati sulla stessa riga (con scorrimento orizzontale fluido se lo spazio è ridotto)."
      }
    ]
  },
  {
    version: "1.3.9",
    date: "2026-07-05",
    title: "Integrazione Area di Testo Frequenza per Fibra",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Nuova Area di Testo Frequenza: Sostituito l'input di testo della frequenza per la fibra con una comoda area di testo (textarea) ridimensionata, posizionata direttamente a fianco del cursore della potenza."
      }
    ]
  },
  {
    version: "1.3.8",
    date: "2026-07-05",
    title: "Miglioramenti Scheda Lavorazione e Controlli Radio",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Pulsante Preferiti: Integrato un pulsante di selezione rapida 'Preferiti' direttamente a fianco del nome del materiale nella scheda di lavorazione per salvare o rimuovere all'istante la configurazione."
      },
      {
        category: "improvement",
        text: "Selettore Software Radio: Sostituite le caselle di controllo (checkboxes) del software con selettori radio ad opzione singola esclusiva (Nessuno, Lightburn, SCA Laser, EZCAD) per evitare conflitti."
      },
      {
        category: "improvement",
        text: "Frequenza Condizionale: Per le configurazioni Fibra, il campo della frequenza viene ora visualizzato ordinatamente a fianco della potenza, ottimizzando lo spazio."
      },
      {
        category: "improvement",
        text: "Layout Velocità e Passaggi: Velocità e passaggi sono ora affiancati sulla stessa riga a ingombro ridotto, e il campo dei passaggi è stato trasformato in una comoda barra di regolazione da 1 a 10."
      },
      {
        category: "improvement",
        text: "Pulizia Icona Tabella: Rimossa la ridondante icona di modifica in fondo alla tabella, rendendo la visualizzazione dei materiali più pulita ed evidenziando la possibilità di fare clic direttamente su qualsiasi riga."
      }
    ]
  },
  {
    version: "1.3.7",
    date: "2026-07-05",
    title: "Filtri Intelligenti Laser e Ottimizzazione Interfaccia Lavorazioni",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Pannello Filtri Avanzato: Introdotto un comodo pannello di filtri rapido posizionato sotto la tab-navigation del modello laser per filtrare istantaneamente i materiali per Software (Lightburn, SCA Laser, EZCAD)."
      },
      {
        category: "feature",
        text: "Scorciatoie Materiale Intelligenti: Generazione dinamica dei 3 materiali più utilizzati o impostati come preferiti per un rapido accesso con un singolo clic, riducendo l'ingombro visivo."
      },
      {
        category: "improvement",
        text: "Righe Tabella Cliccabili: L'intera riga della tabella parametri è ora interattiva e cliccabile per aprire istantaneamente la scheda di dettaglio dei parametri, migliorando notevolmente l'ergonomia d'uso."
      },
      {
        category: "improvement",
        text: "Pulizia Unità di Misura: Rimosse le diciture ridondanti 'mm/s' dai parametri di velocità sia nell'interfaccia, sia nei preset e nei campi di inserimento, lasciando i valori numerici puliti."
      }
    ]
  },
  {
    version: "1.3.6",
    date: "2026-07-05",
    title: "Navigazione per Anno ed Autocompilazione Clienti via RegistroImprese.it",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Navigazione Preventivi per Anno: Aggiunta una comoda barra di navigazione a schede (Tab Navigation) in cima all'elenco dei preventivi per filtrare istantaneamente i documenti per anno d'emissione."
      },
      {
        category: "feature",
        text: "Autocompilazione Anagrafica Clienti: Introdotta l'integrazione intelligente con il Registro Imprese delle Camere di Commercio d'Italia. Cliccando su 'Nuovo Cliente' è ora disponibile una lente di ingrandimento per cercare e recuperare istantaneamente dati reali (Ragione Sociale, P.IVA/CF, Indirizzo, CAP, Città, Telefono, Email/PEC)."
      },
      {
        category: "improvement",
        text: "Rafforzamento dei fallback locali: Nel caso in cui la chiave API di Gemini con Google Search Grounding non sia disponibile, il sistema calcola un set di dati ditta estremamente coerente e verosimile in modo trasparente senza interrompere il flusso."
      }
    ]
  },
  {
    version: "1.3.5",
    date: "2026-07-04",
    title: "Gestione Materiali con Preset e Abbinamento Cliente",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Abbinamento Lavorazioni ai Clienti: Introdotta la possibilità di associare direttamente una riga di lavorazione laser a un cliente del gestionale tramite un comodo menù a tendina."
      },
      {
        category: "feature",
        text: "Preset e Salvataggio Materiali: Aggiunto un sistema di salvataggio dei materiali come preset (cliccando sull'icona stella). I materiali salvati possono essere richiamati rapidamente da un menù a tendina integrato per auto-compilare istantaneamente tutti i parametri."
      },
      {
        category: "improvement",
        text: "Campo di Ricerca Avanzato: Aggiunto un filtro di ricerca intelligente che permette di filtrare le lavorazioni laser in tempo reale sia per nome del materiale sia per nome del cliente abbinato."
      },
      {
        category: "improvement",
        text: "Gestione Preset in evidenza: Creato un pannello riepilogativo in alto che mostra tutti i preset salvati con possibilità di cancellarli in un clic."
      }
    ]
  },
  {
    version: "1.3.3",
    date: "2026-07-04",
    title: "Spegnimento Automatico e Rilevamento Chiusura Browser",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Implementato un sistema di Heartbeat (battito cardiaco) bidirezionale tra browser e server locale Node.js."
      },
      {
        category: "improvement",
        text: "Il server rileva automaticamente quando l'ultima scheda del browser o l'intero browser viene chiuso, spegnendosi automaticamente per liberare la porta 3000 ed evitare futuri errori di tipo EADDRINUSE o l'esecuzione di processi orfani in background."
      },
      {
        category: "improvement",
        text: "Ottimizzato per funzionare in scenari multi-scheda: se chiudi una singola scheda ma ne hai altre ancora attive con l'applicazione aperta, il server rimane regolarmente in esecuzione."
      },
      {
        category: "bugfix",
        text: "Il sistema di auto-spegnimento viene disabilitato automaticamente se eseguito in ambiente cloud (come Google AI Studio o Cloud Run), garantendo la continuità del servizio."
      }
    ]
  },
  {
    version: "1.3.2",
    date: "2026-07-04",
    title: "Supporto Static Assets su macOS e Cloud Run",
    type: "patch",
    changes: [
      {
        category: "bugfix",
        text: "Introdotta la differenziazione tra ambiente di sviluppo e produzione per il caricamento degli asset statici. Questo risolve il problema delle pagine senza stile (un-styled text) su macOS/Safari quando l'applicazione viene caricata all'interno dell'iFrame di Google AI Studio."
      },
      {
        category: "improvement",
        text: "Migliorata la stabilità del server Node.js escludendo l'avvio del server di sviluppo Vite quando eseguito in Cloud Run (ambiente di produzione)."
      }
    ]
  },
  {
    version: "1.3.1",
    date: "2026-07-04",
    title: "Connessione MariaDB e Permessi Rete",
    type: "patch",
    changes: [
      {
        category: "bugfix",
        text: "Risolti i problemi di permessi d'accesso per gli utenti MariaDB sulla rete locale (gestione corretta di 'preventivi_user'@'192.168.0.123') e fornita diagnostica chiara."
      },
      {
        category: "improvement",
        text: "Migliorato il feedback visivo per il test di connessione con risposte chiare sui blocchi firewall, porte abilitate (es. 3307) e restrizioni dell'host."
      }
    ]
  },
  {
    version: "1.3.0",
    date: "2026-07-03",
    title: "Gestione Lavorazioni Laser e Parametri Materiali",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Nuova sezione interattiva 'Lavorazione Laser' per tracciare i parametri dei materiali (Potenza, Velocità, Passaggi, Frequenza, Note) con schede dedicate per X352, Fibra e Prometheo."
      },
      {
        category: "feature",
        text: "Introdotta la modifica immediata e diretta delle singole celle della tabella, con pulsanti rapidi per duplicare intere righe, eliminare configurazioni e inserire nuovi materiali con un clic."
      },
      {
        category: "improvement",
        text: "Integrazione completa nel cloud-sync: le configurazioni di incisione e taglio laser vengono ora incluse in automatico nei flussi di backup e ripristino di GitHub."
      }
    ]
  },
  {
    version: "1.2.5",
    date: "2026-07-02",
    title: "Nuovo Centro Aggiornamenti e Backup",
    type: "patch",
    changes: [
      {
        category: "feature",
        text: "Nuovo 'Centro Aggiornamenti' interattivo con connessione diretta a GitHub per il confronto riga per riga di file aggiunti, modificati ed eliminati."
      },
      {
        category: "improvement",
        text: "Pannello GitHub aggiornato: aggiunto pulsante per salvare la configurazione del repository e opzione per mostrare/nascondere il Token Personale (asterischi) per una maggiore sicurezza."
      },
      {
        category: "feature",
        text: "Riorganizzazione completa dell'architettura di backup: isolato il salvataggio dei dati dal codice applicativo, garantendo l'immutabilità dei preventivi personali."
      },
      {
        category: "improvement",
        text: "Pulizia dell'header: rimosso il pulsante ridondante di scaricamento database per fare spazio al nuovo pannello di gestione salvataggi e al Centro Aggiornamenti."
      }
    ]
  },
  {
    version: "1.2.0",
    date: "2026-07-02",
    title: "Sezione Cronologia Aggiornamenti",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Aggiunto pannello 'Cronologia Aggiornamenti' (Changelog) interattivo per monitorare lo stato di avanzamento e i dettagli di ciascuna release del progetto, partendo dalla versione 1.0."
      },
      {
        category: "improvement",
        text: "Migliorato il design dell'interfaccia utente con schede e badge colorati per identificare al volo nuove funzionalità, ottimizzazioni e correzioni di bug."
      }
    ]
  },
  {
    version: "1.1.0",
    date: "2026-07-02",
    title: "Backup Rapido e Sicurezza GitHub",
    type: "minor",
    changes: [
      {
        category: "feature",
        text: "Aggiunto pulsante di 'Backup Rapido' (Download File JSON) direttamente nell'header dell'applicazione per consentire salvataggi istantanei locali fuori da GitHub."
      },
      {
        category: "improvement",
        text: "Sanitizzazione del nome repository GitHub (rimozione automatica del prefisso 'github.com' e dei protocolli url copiati erroneamente dall'utente)."
      },
      {
        category: "bugfix",
        text: "Gestione avanzata dell'errore '404 Not Found' per GitHub: introdotte istruzioni chiare per repository privati o inesistenti e spiegazione sull'obbligatorietà del Token GitHub Personale."
      }
    ]
  },
  {
    version: "1.0.0",
    date: "2026-07-01",
    title: "Rilascio Iniziale - Gestionale Preventivi",
    type: "major",
    changes: [
      {
        category: "feature",
        text: "Creazione della Dashboard principale con riepilogo preventivi recenti e anagrafiche clienti."
      },
      {
        category: "feature",
        text: "Pannello completo 'Preventivi' per la creazione, modifica, eliminazione e duplicazione di preventivi con calcolo automatico di IVA, ritenuta d'acconto, rivalsa e sconti."
      },
      {
        category: "feature",
        text: "Sezione 'Anagrafiche' per la memorizzazione di clienti privati o aziende e cataloghi di prodotti/servizi ricorrenti."
      },
      {
        category: "feature",
        text: "Generatore di PDF integrato con anteprima a schermo per l'invio o la stampa dei preventivi pronti per il cliente."
      },
      {
        category: "feature",
        text: "Integrazione con le API di GitHub per il salvataggio remoto e la sincronizzazione automatica bidirezionale del database locale (tramite data/db.json)."
      }
    ]
  }
];
