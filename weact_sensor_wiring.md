---
name: WeAct Sensor Wiring
overview: Schema preciso di collegamento per tutti i sensori della telemetria sulla board WeAct MiniSTM32H743, con pin esatti e interfacce ottimali.
todos:
  - id: reconfigure-cubemx
    content: "Riconfigurare il progetto CubeMX: UART4 (PA0/PA1), I2C2 (PB10/PB11), TIM2_CH1 (PA5), ADC1 (PC0/PC1/PC4/PC5), aggiornare SDMMC e SPI1 per la nuova board"
    status: pending
  - id: configure-i2c
    content: Configurare I2C2 (PB10 SCL, PB11 SDA) in CubeMX per IMU ISM330DHCX tramite Qwiic
    status: pending
  - id: add-sensor-drivers
    content: "Aggiungere driver per: NEO-M9N (UART NMEA/UBX parse), ISM330DHCX (I2C2), ADC multi-channel, TIM2 input capture per wheel speed"
    status: pending
isProject: false
---

# Schema Collegamento Sensori - WeAct MiniSTM32H743

## Identificazione sensori confermata

- **GPS-17285**: SparkFun GPS Breakout - u-blox **NEO-M9N**, SMA (Qwiic) — 3.3V, UART/I2C
- **SEN-20176**: SparkFun **Micro** 6DoF IMU - **ISM330DHCX** (Qwiic) — versione Micro, **solo 4 pin Qwiic (I2C)**, nessun pin interrupt esposto
- **Wheel speed sensor**: Hall effect digitale (square wave output)
- **2x Brake position sensor**: analogico (potenziometro/Hall 0–3.3V)
- **2x Travel sensor** (sospensioni): analogico (potenziometro 0–3.3V)
- **Batteria 3V**: CR2032 per VBAT (RTC backup STM32)

## Pin onboard WeAct MiniSTM32H743 — OCCUPATI (da non usare)

- **SPI1** (NOR Flash 8MB): `B3` SCK, `B4` MISO, `D7` MOSI, `D6` NSS
- **QSPI** (QSPI Flash 8MB): `B2`, `B6`, `D11`, `D12`, `E2`, `D13`
- **SPI4** (LCD ST7735): `E11` NSS, `E12` SCK, `E13` MISO, `E14` MOSI
- **SDMMC1** (microSD integrata): `C8`–`C12`, `D2`, `D4`
- **USB-C**: `A11` DM, `A12` DP
- **LED**: `E3` — **Button**: `C13`
- **LSE crystal**: `C14`, `C15` — **HSE crystal**: `H0`, `H1`

---

## Legenda etichette board (dalla silkscreen)

I pin sulla silkscreen WeAct usano il formato `LetteraNumerо` senza la "P":
`A0`=PA0, `B10`=PB10, `C3`=PC3, `D3`=PD3, `VB`=VBAT, `NR`=NRST, `V+`=VREF+

**Header DESTRO** (lato sinistro del PCB — con A, B, C, E, VB):

```
E2  E3
E4  E5
E6  VB   ← VBAT qui
C13 NR
C0  C1
C2  C3
GND V+
A0  A1
A2  A3
A4  A5
A6  A7
C4  C5
B0  B1
B2  E7
E8  E9
E10 E11
E12 E13
E14 E15
B10 B11
3V3 5V
GND GND
```

**Header SINISTRO** (lato destro del PCB — con D, parte di B e C):

```
E1  E0
B8  B9
B7  B6
B5  B4
B3  D7
D6  D5
D4  D3   ← PD3 qui (SPI2_SCK per futuri accel)
D2  D1
D0  C12
C11 C10
A11 A10
A9  A8
...
B15 B14
```

---

## Schema di collegamento

### 1 — GPS NEO-M9N (GPS-17285) → UART4

Tutti i pin sull'**header DESTRO**.


| Etichetta board | STM32          | Direzione | GPS-17285 |
| --------------- | -------------- | --------- | --------- |
| **3V3**         | 3.3V           | →         | VCC       |
| **GND**         | GND            | →         | GND       |
| **A0**          | UART4_TX (AF8) | →         | RXI       |
| **A1**          | UART4_RX (AF8) | ←         | TXO       |


> Baud rate default NEO-M9N: 9600 (configurabile via UBX fino a 921600). Il modulo ha già la backup battery onboard.

---

### 2 — IMU ISM330DHCX (SEN-20176) → I2C2 (Qwiic)

Connettore Qwiic: JST SH 4 pin 1mm. Tutti i pin sull'**header DESTRO**.


| Etichetta board | STM32          | Direzione | Qwiic SEN-20176      |
| --------------- | -------------- | --------- | -------------------- |
| **3V3**         | 3.3V           | →         | pin 1 — rosso        |
| **GND**         | GND            | →         | pin 2 — nero         |
| **B10**         | I2C2_SCL (AF4) | →         | pin 3 — giallo (SCL) |
| **B11**         | I2C2_SDA (AF4) | ↔         | pin 4 — blu (SDA)    |


> I2C address: **0x6B** (default). Pull-up 4.7kΩ già presenti sul modulo Qwiic — non aggiungerne altri.

---

### 3 — Wheel Speed Sensor (Hall effect) → TIM2_CH1

Pin sull'**header DESTRO**.


| Etichetta board  | STM32          | Direzione | Sensore                  |
| ---------------- | -------------- | --------- | ------------------------ |
| **3V3** o **5V** | alimentazione  | →         | VCC (verifica datasheet) |
| **GND**          | GND            | →         | GND                      |
| **A5**           | TIM2_CH1 (AF1) | ←         | Signal                   |


> Configurare come Input Capture per misurare la frequenza. Abilitare pull-up interno se uscita open-collector.

---

### 4 — 2× Brake Position Sensor → ADC1

Pin sull'**header DESTRO**.


| Etichetta board              | STM32      | Sensore            |
| ---------------------------- | ---------- | ------------------ |
| **3V3** → VCC, **GND** → GND |            | entrambi i sensori |
| **C0**                       | ADC1_INP10 | ← Signal Brake 1   |
| **C1**                       | ADC1_INP11 | ← Signal Brake 2   |


> Se il sensore ha uscita 0–5V, inserire un partitore resistivo (10kΩ + 6.8kΩ) per scendere a ~3.3V.

---

### 5 — 2× Travel Sensor (sospensioni) → ADC1/ADC2

Pin sull'**header DESTRO**.


| Etichetta board              | STM32      | Sensore            |
| ---------------------------- | ---------- | ------------------ |
| **3V3** → VCC, **GND** → GND |            | entrambi i sensori |
| **C4**                       | ADC12_INP4 | ← Signal Travel 1  |
| **C5**                       | ADC12_INP8 | ← Signal Travel 2  |


> Stessa nota dei sensori freni per eventuale 0–5V.

---

### 6 — Batteria 3V → VBAT STM32

Il pin **"VB"** è direttamente sull'**header DESTRO**, nella terza riga dall'alto accanto a "E6".


| Etichetta board                    | CR2032            |
| ---------------------------------- | ----------------- |
| **VB** (VBAT)                      | Polo positivo (+) |
| **GND** (qualsiasi GND del header) | Polo negativo (–) |


> Il pin VBAT accetta 1.58–3.6V — la CR2032 da 3V si collega direttamente, senza resistori.

---

### 7 — Futuri 2–3 Accelerometri

Due opzioni possibili, da decidere in base al modello scelto:

**Opzione A — I2C2 (stesso bus Qwiic dell'IMU), header DESTRO**

- Stessi pin **B10** (SCL) e **B11** (SDA) — collegare in parallelo
- Ogni sensore deve avere un **I2C address diverso** (tramite jumper ADR sul breakout)

**Opzione B — SPI2 (bus dedicato, più veloce)**

Bus condiviso — pin su header **SINISTRO** (D3) e **DESTRO** (C2, C3):


| Etichetta board | STM32           | Header   |
| --------------- | --------------- | -------- |
| **D3**          | SPI2_SCK (AF5)  | SINISTRO |
| **C2**          | SPI2_MISO (AF5) | DESTRO   |
| **C3**          | SPI2_MOSI (AF5) | DESTRO   |


CS dedicati (header **DESTRO**):


| Accelerometro | Etichetta board | STM32 |
| ------------- | --------------- | ----- |
| Accel 2       | **E4**          | PE4   |
| Accel 3       | **E5**          | PE5   |
| Accel 4       | **E7**          | PE7   |


---

## Riepilogo visivo — Header DESTRO

```
Header DESTRO (etichette silkscreen)
┌──────────────────────────────────────────────┐
│ E2   E3  │                                   │
│ E4   E5  │ ← futuri CS accel (Opz. B)        │
│ E6   VB  │ ← VB = CR2032 (+)                 │
│ C13  NR  │                                   │
│ C0   C1  │ ← Brake sensor 1 / 2 (ADC)        │
│ C2   C3  │ ← SPI2 MISO/MOSI (futuri accel)   │
│ GND  V+  │                                   │
│ A0   A1  │ ← GPS TX / RX (UART4)             │
│ A2   A3  │                                   │
│ A4   A5  │ ← A5 = Wheel speed (TIM2)         │
│ A6   A7  │                                   │
│ C4   C5  │ ← Travel sensor 1 / 2 (ADC)       │
│ B0   B1  │                                   │
│ B2   E7  │                                   │
│ E8   E9  │                                   │
│ E10  E11 │                                   │
│ E12  E13 │ ← LCD (onboard, non usare)         │
│ E14  E15 │ ← LCD (onboard, non usare)         │
│ B10  B11 │ ← IMU SCL / SDA (I2C2 Qwiic)      │
│ 3V3  5V  │                                   │
│ GND  GND │                                   │
└──────────────────────────────────────────────┘

Header SINISTRO — solo D3 usato per futuri accel SPI
│ D4   D3  │ ← D3 = SPI2_SCK (futuri accel)    │
```

