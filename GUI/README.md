# 🚲 Bike Telemetry Analysis GUI

Sistema completo per la visualizzazione, analisi e confronto di dati telemetrici per bicicletta.  
Backend **FastAPI + SQLite**, frontend **HTML/CSS/JS** con **Plotly.js** e **Leaflet**.

---

## 📋 Indice

1. [Avvio rapido](#-avvio-rapido)
2. [Architettura](#-architettura)
3. [Formato dati](#-formato-dati)
4. [Pagine e navigazione](#-pagine-e-navigazione)
5. [Analisi (analysis.html)](#-analisi)
6. [Confronto Runs (compare.html)](#-confronto-runs)
7. [Gestione Bici e Setup](#-gestione-bici-e-setup)
8. [Note Run](#-note-run)
9. [Profili Tracciato](#-profili-tracciato)
10. [Splits e Segmenti](#-splits-e-segmenti)
11. [Mappa GPS](#-mappa-gps)
12. [Grafici](#-grafici)
13. [Filtri](#-filtri)
14. [Sessioni (salva/carica)](#-sessioni-salvaccarica)
15. [Export e Import (Database)](#-export-e-import-database)
16. [Impostazioni](#-impostazioni)
17. [API Backend](#-api-backend)
18. [Struttura file](#-struttura-file)
19. [Troubleshooting](#-troubleshooting)

---

## 🚀 Avvio rapido

### Requisiti

- **Python 3.10+**
- **Browser moderno** (Chrome, Firefox, Edge)

### Installazione e avvio

```bash
# 1. Vai nella cartella backend
cd GUI/backend

# 2. Crea il virtual environment (solo la prima volta)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Avvia il server
./run.sh
```

Oppure manualmente:

```bash
cd GUI/backend
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Accesso

| Pagina | URL |
|--------|-----|
| **Home** | http://localhost:8000/ |
| **Analisi** | http://localhost:8000/analysis.html |
| **Confronto Runs** | http://localhost:8000/compare.html |
| **API Docs** | http://localhost:8000/docs |

> Il server sulla porta **8000** serve sia le API che il frontend. Non serve altro.

---

## 🏗️ Architettura

```
┌─────────────────────────────────────────────┐
│                  BROWSER                     │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ analysis │  │ compare  │  │   index   │  │
│  │  .html   │  │  .html   │  │   .html   │  │
│  └────┬─────┘  └────┬─────┘  └───────────┘  │
│       │              │                        │
│  ┌────┴──────────────┴────────────────────┐  │
│  │         Moduli JavaScript (ES6)         │  │
│  │                                         │  │
│  │  data-store.js    ← Centro dati         │  │
│  │  chart-manager.js ← Grafici Plotly      │  │
│  │  map-view.js      ← Mappa Leaflet       │  │
│  │  filter-panel.js  ← Filtri              │  │
│  │  splits-panel.js  ← Partenza/Arrivo     │  │
│  │  settings-panel.js← Bici/Setup/Note     │  │
│  │  session-manager.js← Sessioni JSON      │  │
│  │  api-client.js    ← Client HTTP         │  │
│  │  db-manager.js    ← Bridge verso DB     │  │
│  │  compare-view.js  ← Modulo confronto    │  │
│  │  stats-panel.js   ← Statistiche         │  │
│  │  data-table.js    ← Tabella dati        │  │
│  └────────────────────┬───────────────────┘  │
│                       │ fetch()              │
└───────────────────────┼──────────────────────┘
                        │
                   ┌────┴─────┐
                   │  FastAPI  │  ← porta 8000
                   │  Backend  │
                   └────┬─────┘
                        │
                   ┌────┴─────┐
                   │  SQLite   │  ← GUI/backend/data/telemetry.db
                   │  Database │
                   └──────────┘
```

### Comunicazione tra moduli

I moduli comunicano tramite **eventi** nel `DataStore`:

| Evento | Quando | Chi ascolta |
|--------|--------|-------------|
| `data-loaded` | File caricato e parsato | ChartManager, MapView, SplitsPanel, StatsPanel, DataTable |
| `data-filtered` | Filtri o splits applicati | ChartManager, MapView, StatsPanel, DataTable |
| `columns-ready` | Colonne disponibili | FilterPanel, ChartManager |
| `cursor-changed` | Hover/click su un punto | Tutti i grafici, mappa, barra cursor |
| `splits-changed` | Splits modificati | ChartManager, MapView, SplitsPanel, DbManager |
| `settings-changed` | Impostazione cambiata | ChartManager, MapView, DataStore |

---

## 📄 Formato dati

Il file telemetria deve essere un **CSV/TXT** con header:

```
timestamp, ax, ay, az, wx, wy, wz, lat, lon, alt_m, travel_r_v
```

| Colonna | Unità | Descrizione |
|---------|-------|-------------|
| `timestamp` | ms (convertito in s) | Tempo dal sensore |
| `ax`, `ay`, `az` | g | Accelerometro 3 assi |
| `wx`, `wy`, `wz` | rad/s | Giroscopio 3 assi |
| `lat`, `lon` | ° | Coordinate GPS |
| `alt_m` | m | Altitudine GPS |
| `travel_r_v` | V | Tensione sensore escursione posteriore |

> **Nota**: Il timestamp viene automaticamente convertito da millisecondi a secondi (configurabile nelle impostazioni).

### Colonne derivate (calcolate automaticamente)

| Colonna | Unità | Descrizione |
|---------|-------|-------------|
| `travel_r_mm` | mm | Escursione in millimetri |
| `travel_r_pct` | % | Escursione in percentuale (default nei grafici) |

---

## 🗂️ Pagine e navigazione

### Home (`index.html`)
Pagina principale con navigazione verso:
- **Analysis** → Analisi completa di una singola run
- **Confronto Runs** → Confronto tra più runs

### Analysis (`analysis.html`)
Interfaccia principale per l'analisi di una singola run telemetrica.

### Compare (`compare.html`)
Interfaccia per caricare e confrontare più runs simultaneamente.

---

## 📊 Analisi

### Caricamento file

1. **Pulsante "Carica File"** nella barra superiore
2. **Drag & drop** del file ovunque nella pagina
3. **Ctrl+O** scorciatoia tastiera

### Barra laterale (sidebar)

La sidebar ha 7 tab:

| Tab | Icona | Funzione |
|-----|-------|----------|
| **Grafici** | 📈 | Configura tipo, assi X/Y/Z per ogni grafico |
| **Splits** | ┃┆┃ | Imposta partenza, arrivo e intermedi |
| **Filtri** | 🔽 | Filtra dati per colonna e condizione |
| **Statistiche** | 📊 | Min, max, media, deviazione standard per colonna |
| **Mappa** | 📍 | Mappa GPS con posizionamento splits |
| **Tabella** | ⊞ | Tabella dati con paginazione e export CSV |
| **Impostazioni** | ⚙️ | Bici, setup, note run, sensore, display |

### Barra superiore

| Pulsante | Funzione |
|----------|----------|
| **Carica File** | Apre file telemetria (.txt, .csv) |
| **📦 Esporta** | Esporta run completa dal database (bici + setup + dati + note) |
| **📥 Importa** | Importa un file di export nel database |
| **💾 Salva** | Salva sessione corrente come file JSON |
| **📂 Carica** | Carica sessione da file JSON |
| **🏁 Confronta** | Vai alla pagina confronto |
| **🟢/⚫** | Indicatore stato database (verde = connesso) |

### Barra cursor

Quando si passa il mouse su un grafico, la barra in alto mostra i valori di **tutti i canali** nel punto selezionato, sincronizzati su tutti i grafici e sulla mappa.

---

## 🏁 Confronto Runs

### Caricamento

- **Da file**: Pulsante "Aggiungi Run" → seleziona uno o più file
- **Da database**: Pulsante "Carica da DB" → seleziona le runs dalla lista

### Funzionalità

- **Grafici sovrapposti**: Tutti i canali delle runs selezionate sullo stesso grafico
- **Mappa multi-tracciato**: Ogni run ha un colore diverso
- **Tabella confronto splits**: Tempi dei settori affiancati
- **Tabella confronto setup**: Setup delle varie runs a confronto
- **Visibilità**: Ogni run può essere nascosta/mostrata individualmente
- **Colori**: Ogni run ha un colore unico assegnato automaticamente

---

## 🚲 Gestione Bici e Setup

### Architettura a 3 livelli

```
BICI (statica, tutta la stagione)
 └── SETUP (tunabile, cambia spesso)
      └── RUN NOTES (per ogni registrazione)
```

### Bici

La bici contiene le informazioni **statiche** che non cambiano durante la stagione:

- **Telaio**: marca, modello, taglia, anno, peso
- **Forcella**: marca, modello, corsa (mm)
- **Ammortizzatore**: marca, modello, corsa (mm)
- **Gomme**: marca, modello, misura (anteriore e posteriore)
- **Trasmissione**: tipo, corona, cassetta
- **Freni**: anteriore, posteriore, dischi (mm), tipo pastiglie
- **Ruote**: anteriore, posteriore
- **Note**: campo libero

#### Operazioni

| Azione | Come |
|--------|------|
| **Nuova bici** | Tab Impostazioni → "🚲 La Mia Bici" → "+ Nuova Bici" |
| **Modifica** | Pulsante ✏️ accanto alla bici attiva |
| **Seleziona bici attiva** | Dropdown "Bici attiva" |
| **Esporta** | Pulsante 💾 → scarica file JSON con bici + tutti i setup |
| **Importa** | Pulsante 📂 → carica file JSON |

### Setup (Tunabili)

I parametri di setup cambiano frequentemente, anche nella stessa giornata:

- **Forcella**: pressione (PSI), HSC, LSC, HSR, LSR, tokens/spacers
- **Ammortizzatore**: pressione (PSI), HSC, LSC, HSR, LSR, tokens/spacers
- **Gomme**: pressione anteriore (bar), inserto anteriore, pressione posteriore (bar), inserto posteriore
- **Note**: campo libero

Ogni setup è **collegato a una bici**.

#### Operazioni

| Azione | Come |
|--------|------|
| **Nuovo setup** | Tab Impostazioni → "🔧 Setup Tunabili" → "+ Nuovo Setup" |
| **Modifica** | Pulsante ✏️ |
| **Applica alla run** | Pulsante 📌 → associa il setup alla run corrente |
| **Esporta** | Pulsante 💾 |
| **Importa** | Pulsante 📂 |
| **Elimina** | Pulsante ✕ |

---

## 📝 Note Run

Ogni registrazione può avere note associate:

### Associazioni
- **Bici** → seleziona dal dropdown
- **Setup** → seleziona dal dropdown (filtrato per bici)

### Condizioni
- Data, luogo, nome tracciato
- Meteo (soleggiato, nuvoloso, pioggia, ecc.)
- Temperatura (°C), umidità (%)
- Condizione terreno (asciutto, umido, bagnato, fangoso, ecc.)

### Rider
- Nome, peso (kg)

### Feedback
- Obiettivo sessione
- Modifiche setup
- Feeling (1-5 con emoji: 😫😕😐🙂🤩)
- Note/sensazioni
- Tags (es: "test, gara")

> Clicca **"💾 Salva Note Run"** per salvare.

---

## 🗺️ Profili Tracciato

I profili tracciato permettono di **salvare e riutilizzare** le configurazioni di splits (partenza, arrivo, intermedi) per un tracciato specifico.

### Creare un profilo

1. Configura gli splits (partenza, arrivo, intermedi) come desideri
2. Vai nel tab **Splits** nella sidebar
3. Clicca **"💾 Salva Profilo Tracciato"**
4. Inserisci un nome (es: "Crossbox", "Rollercoaster DH")
5. Il profilo viene salvato nel database e in localStorage

### Caricare un profilo

1. Vai nel tab **Splits** nella sidebar
2. Nella sezione **"📋 Profili Tracciato"** vedrai la lista dei profili salvati
3. Clicca **"📌 Applica"** per applicare il profilo alla run corrente

### Gestione profili

| Azione | Come |
|--------|------|
| **Applica** | Pulsante 📌 → applica splits alla run corrente |
| **Aggiorna** | Pulsante 🔄 → aggiorna il profilo con gli splits correnti |
| **Elimina** | Pulsante ✕ → elimina il profilo |

### Caricamento automatico

Quando carichi una nuova run, il sistema ti chiederà:

> *"Vuoi riutilizzare gli splits correnti o azzerarli?"*

- **Riusa**: Mantiene partenza, arrivo e intermedi attuali
- **Azzera**: Rimuove tutti gli splits
- **Carica profilo**: Apre la lista dei profili salvati

---

## ✂️ Splits e Segmenti

### Impostazione da sidebar

1. Vai nel tab **Splits**
2. Inserisci il tempo (in secondi assoluti) per:
   - 🟢 **Partenza**
   - 🔴 **Arrivo**
   - 🟡 **Intermedi** (numero arbitrario)
3. Clicca **"Applica Splits"**

### Impostazione dalla mappa

1. Vai nel tab **Mappa**
2. Nella sezione "Posiziona splits sulla mappa":
   - Clicca **🟢 Partenza**, poi clicca sulla mappa
   - Clicca **🔴 Arrivo**, poi clicca sulla mappa
   - Clicca **🟡 Intermedio**, poi clicca sulla mappa
3. Puoi anche **trascinare** i marker già posizionati

### Effetti degli splits

- I **grafici** mostrano solo i dati tra partenza e arrivo
- Il **tempo** parte da 0s alla partenza
- Le **linee verticali** colorate appaiono sui grafici
- La **mappa** mostra sempre il tracciato completo, evidenziando la sezione attiva

---

## 🗺️ Mappa GPS

### Visualizzazione

- **Tracciato completo**: sempre visibile in colore cyan/acqua
- **Sezione attiva**: evidenziata quando ci sono splits
- **Marker splits**: icone colorate per partenza (🟢), arrivo (🔴), intermedi (🟡)
- **Linee perpendicolari**: al tracciato nei punti split
- **Sfondo satellitare**: immagini Esri World Imagery

### Colorazione tracciato

Dal dropdown "Colora tracciato per:" puoi colorare il tracciato in base a qualsiasi canale (velocità, accelerazione, travel, ecc.)

### Interazione

- **Hover**: mostra il punto corrispondente sui grafici
- **Click**: posiziona il cursore
- **Drag marker**: sposta i punti split

---

## 📈 Grafici

### Tipi disponibili

| Tipo | Descrizione |
|------|-------------|
| **Linea** | Grafico a linee (default) |
| **Scatter** | Punti sparsi |
| **Scatter 3D** | Grafico tridimensionale |
| **Istogramma** | Distribuzione dei valori |
| **Barre** | Grafico a barre |

### Configurazione

Per ogni grafico puoi impostare:
- **Asse X**: qualsiasi colonna (default: timestamp)
- **Asse Y**: una o più colonne (multi-selezione)
- **Asse Z**: solo per Scatter 3D

### Operazioni

| Azione | Come |
|--------|------|
| **Aggiungi** | Pulsante "+ Aggiungi Grafico" nella sidebar |
| **Rimuovi** | Pulsante ✕ nell'header del grafico |
| **Espandi** | Pulsante ⛶ per fullscreen |
| **Aggiorna** | Pulsante "Aggiorna Grafico" nella sidebar |

### Grafici default

Quando carichi un file, vengono creati automaticamente:
1. **Accelerometro** (ax, ay, az vs tempo)
2. **Giroscopio** (wx, wy, wz vs tempo)
3. **Travel** (escursione % vs tempo)

### Sincronizzazione cursor

Passando il mouse su un grafico:
- Una **linea verticale** appare su tutti gli altri grafici
- Un **marker** appare sulla mappa nella posizione GPS corrispondente
- La **barra cursor** mostra tutti i valori

---

## 🔽 Filtri

### Operatori disponibili

| Operatore | Descrizione |
|-----------|-------------|
| `>` | Maggiore di |
| `<` | Minore di |
| `>=` | Maggiore o uguale |
| `<=` | Minore o uguale |
| `==` | Uguale a |
| `!=` | Diverso da |
| `between` | Compreso tra due valori |
| `not_between` | Non compreso tra due valori |

### Uso

1. Tab **Filtri** → "+ Aggiungi Filtro"
2. Seleziona colonna, operatore e valore
3. Clicca **"Applica Filtri"**
4. I dati filtrati si aggiornano su grafici, mappa e tabella

---

## 💾 Sessioni (salva/carica)

### Cosa viene salvato in una sessione

- Splits (partenza, arrivo, intermedi)
- Configurazione grafici (tipo, assi)
- Filtri attivi
- Colorazione mappa
- Impostazioni display
- Note run
- Bici e setup

### Salvataggio

- **File JSON**: Pulsante 💾 nella barra superiore (o Ctrl+S)
- **Auto-save**: Automatico in localStorage ogni 2 secondi dopo modifiche

### Caricamento

- **Da file**: Pulsante 📂 nella barra superiore
- **Auto-load**: Automatico da localStorage quando ricarichi lo stesso file

---

## 📦 Export e Import (Database)

### Export

Il pulsante **📦 Esporta** crea un file JSON contenente:
- Dati telemetrici completi
- Bici associata
- Setup associato
- Note run (meteo, feeling, ecc.)
- Splits configurati
- Configurazione grafici e filtri
- Impostazioni sensore

### Import

Il pulsante **📥 Importa** carica un file di export:
- Crea la bici nel database (se non esiste già)
- Crea il setup
- Crea la run con tutti i dati telemetrici
- Ripristina splits e configurazioni

> Utile per condividere runs con altri utenti o fare backup.

---

## ⚙️ Impostazioni

### Sensore Travel

| Parametro | Default | Descrizione |
|-----------|---------|-------------|
| V max (esteso) | 3.3V | Tensione a sospensione estesa (0%) |
| V min (compresso) | 0V | Tensione a sospensione compressa (100%) |
| Corsa totale | 200mm | Escursione totale ammortizzatore |
| Invertito | No | Inverte la direzione della conversione |

### Mappa

| Parametro | Default | Descrizione |
|-----------|---------|-------------|
| Lunghezza righe split | 1m | Lunghezza delle linee perpendicolari ai punti split |
| Spessore tracciato | 3.5px | Spessore della linea del tracciato |
| Opacità inattivo | 0.45 | Opacità della parte di tracciato fuori dagli splits |
| Mostra etichette | Sì | Mostra le etichette dei punti split |

### Grafici

| Parametro | Default | Descrizione |
|-----------|---------|-------------|
| Altezza | 300px | Altezza dei grafici |
| Spessore linea | 1.5px | Spessore delle linee nei grafici |
| Griglia | Sì | Mostra la griglia di sfondo |

### Generali

| Parametro | Default | Descrizione |
|-----------|---------|-------------|
| Decimali | 3 | Numero di decimali nella barra cursor |
| Timestamp | ms→s | Conversione timestamp (ms→s oppure già in secondi) |

---

## 🔌 API Backend

### Endpoint principali

| Metodo | Path | Descrizione |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/bikes` | Lista bici |
| `POST` | `/api/bikes` | Crea bici |
| `PUT` | `/api/bikes/{id}` | Aggiorna bici |
| `DELETE` | `/api/bikes/{id}` | Elimina bici |
| `GET` | `/api/setups` | Lista setup (opz. `?bike_id=`) |
| `POST` | `/api/setups` | Crea setup |
| `PUT` | `/api/setups/{id}` | Aggiorna setup |
| `DELETE` | `/api/setups/{id}` | Elimina setup |
| `GET` | `/api/runs` | Lista runs |
| `POST` | `/api/runs` | Crea run (con CSV inline) |
| `POST` | `/api/runs/upload` | Upload file CSV (multipart) |
| `PUT` | `/api/runs/{id}` | Aggiorna run |
| `DELETE` | `/api/runs/{id}` | Elimina run |
| `GET` | `/api/runs/{id}/data` | Dati telemetrici |
| `GET` | `/api/runs/{id}/export` | Export completo |
| `POST` | `/api/import` | Import completo |
| `GET` | `/api/settings` | Impostazioni app |
| `PUT` | `/api/settings` | Aggiorna impostazioni |

> Documentazione interattiva completa: http://localhost:8000/docs

### Database

Il database SQLite si trova in `GUI/backend/data/telemetry.db`.

Tabelle:
- **bikes** — configurazione bici
- **setups** — parametri tunabili
- **runs** — registrazioni/file importati
- **telemetry_data** — dati telemetrici (JSON per riga)
- **settings** — impostazioni app (key-value)

---

## 📁 Struttura file

```
GUI/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py      ← Schema DB e connessione
│   │   ├── main.py           ← App FastAPI
│   │   ├── models.py         ← Modelli Pydantic
│   │   └── routes.py         ← Endpoint API
│   ├── data/
│   │   └── telemetry.db      ← Database SQLite
│   ├── requirements.txt
│   ├── run.sh                ← Script avvio
│   └── venv/                 ← Virtual environment
│
├── frontend/
│   ├── index.html            ← Home page
│   ├── analysis.html         ← Pagina analisi
│   ├── analysis.css          ← Stili analisi
│   ├── compare.html          ← Pagina confronto
│   ├── compare.css           ← Stili confronto
│   ├── assets/
│   │   ├── main.js           ← JS home page
│   │   └── style.css         ← Stili home page
│   └── modules/
│       ├── data-store.js     ← Centro dati (singleton)
│       ├── chart-manager.js  ← Gestione grafici Plotly
│       ├── map-view.js       ← Mappa Leaflet
│       ├── filter-panel.js   ← Pannello filtri
│       ├── splits-panel.js   ← Pannello splits
│       ├── settings-panel.js ← Bici, setup, note, impostazioni
│       ├── session-manager.js← Salva/carica sessioni
│       ├── stats-panel.js    ← Pannello statistiche
│       ├── data-table.js     ← Tabella dati
│       ├── api-client.js     ← Client HTTP per API
│       ├── db-manager.js     ← Bridge frontend↔database
│       ├── compare-view.js   ← Logica confronto runs
│       └── app.js            ← Orchestratore principale
│
└── README.md                 ← Questa documentazione
```

---

## 🔧 Troubleshooting

### Il server non parte

```bash
# Controlla che il venv sia attivo
source GUI/backend/venv/bin/activate

# Installa le dipendenze
pip install -r GUI/backend/requirements.txt

# Avvia manualmente
cd GUI/backend
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Indicatore database rosso/grigio

L'indicatore ⚫ nella barra superiore significa che il backend non è raggiungibile. Controlla:
1. Il server è avviato?
2. È sulla porta 8000?
3. Controlla la console del browser per errori

> L'applicazione funziona anche **senza backend** (modalità locale), usando solo localStorage.

### I grafici non si aggiornano

- Prova a cliccare **"Applica Filtri"** nel tab Filtri
- Controlla che i dati siano caricati (numero campioni nella barra superiore)

### La mappa non mostra il tracciato

- Verifica che il file contenga colonne `lat` e `lon` con valori GPS validi
- Coordinate nulle o (0,0) vengono ignorate

### Il file non viene caricato

- Formato supportato: CSV con header nella prima riga
- Separatore: virgola (`,`)
- Ogni riga deve avere lo stesso numero di colonne dell'header
- Il timestamp deve essere numerico

### Reset completo

Per resettare tutto:
```bash
# Elimina il database
rm GUI/backend/data/telemetry.db

# Pulisci localStorage (nel browser)
# Console browser → localStorage.clear()

# Riavvia il server
cd GUI/backend && ./run.sh
```

---

## ⌨️ Scorciatoie tastiera

| Scorciatoia | Azione |
|-------------|--------|
| `Ctrl+O` | Apri file |
| `Ctrl+S` | Salva sessione |

---

## 🔮 Sviluppi futuri

- Video sincronizzato con i dati
- Log telemetria in tempo reale via WebSocket
- Analisi automatica delle sospensioni
- Confronto automatico settori
- Export PDF/report
