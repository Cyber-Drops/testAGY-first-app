# BigQuery Release Notes Viewer & Twitter Sharer

Applicazione web full-stack sviluppata con **Python Flask**, **HTML5**, **JavaScript (ES6+)** e **CSS3** per consultare e condividere le note di rilascio ufficiali di **Google BigQuery** dal feed Atom ufficiale:
`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`

---

## 🚀 Caratteristiche Principali

1. **Recupero Dinamico Feed Atom**:
   - Connessione e parsing in tempo reale del feed XML di BigQuery.
   - Parsing intelligente dei singoli annunci/funzionalità all'interno delle voci di data (`Feature`, `Change`, etc.).
   - Sanitizzazione e arricchimento dell'HTML (link ufficiali con `target="_blank"` e `rel="noopener noreferrer"`).
   - Cache in-memory per prestazioni ottimali con supporto al refresh forzato.

2. **Pulsante di Aggiornamento con Indicatore**:
   - Pulsante dedicato **"Aggiorna Feed"** nell'header con spinner animato e disabilitazione dello stato durante il fetch.
   - Notifiche toast e timestamp di ultimo controllo in tempo reale.

3. **Selezione e Condivisione su Twitter / X**:
   - Possibilità di selezionare qualsiasi specifica nota di rilascio con feedback visivo immediato (bordo evidenziato, badge di selezione e barra fluttuante).
   - Pulsante **"Condividi"** istantaneo per aprire la finestra di Twitter Web Intent (`https://twitter.com/intent/tweet`).
   - Modal **"Personalizza Tweet"** con:
     - Editor di testo con conteggio caratteri (limite standard 280).
     - Link di ancoraggio diretto alla documentazione ufficiale.
     - Pulsante per copiare il testo negli appunti.

4. **Filtri e Ricerca Rapida**:
   - Filtro per tipologia: *Tutti*, *Nuove Funzionalità*, *Modifiche*, *Altri*.
   - Barra di ricerca istantanea in tempo reale (cerca per parole chiave nel titolo, corpo e tipologia).

---

## 🛠️ Requisiti e Installazione

### 1. Prerequisiti
- Python 3.9 o superiore

### 2. Installazione delle dipendenze
```bash
pip install -r requirements.txt
```

Le dipendenze installate sono:
- `flask`: server web e routing
- `requests`: download sicuro del feed HTTP/HTTPS
- `beautifulsoup4`: parsing e pulizia dei frammenti HTML

---

## 💻 Avvio dell'Applicazione

Esegui il comando:
```bash
python app.py
```

L'applicazione sarà accessibile nel browser all'indirizzo:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📁 Struttura del Progetto

```
bq-releases-notes/
├── app.py                  # Server Flask & API parser XML Atom
├── requirements.txt        # Dipendenze Python
├── README.md               # Documentazione del progetto
├── templates/
│   └── index.html          # Interfaccia utente principale
└── static/
    ├── css/
    │   └── style.css       # Stili moderni ispirati a Google Cloud
    └── js/
        └── app.js          # Logica client: fetch, render, selezione, Twitter Intent
```
