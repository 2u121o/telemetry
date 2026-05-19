# NUCLEO-H755ZI-Q [UART ReceptionToIdle]


╔══════════════════════════════════════════════════════════════════════════════════╗
║                    NUCLEO-H755ZI-Q — SCHEMA COLLEGAMENTI                       ║
║                         STM32H755ZITx (LQFP144)                                ║
╚══════════════════════════════════════════════════════════════════════════════════╝


    ┌─────────────────────────────────────────────────────────────────────┐
    │                        STM32H755ZI-Q                               │
    │                                                                     │
    │                                                                     │
    │  ┌─── ETHERNET (RMII) ──────────────────────────────────────────┐  │
    │  │                                                               │  │
    │  │  PC1  ── ETH_MDC                                              │  │
    │  │  PA1  ── ETH_REF_CLK          ┌───────────────┐              │  │
    │  │  PA2  ── ETH_MDIO      ──────►│  PHY / RJ45   │              │  │
    │  │  PA7  ── ETH_CRS_DV           │  (on-board)   │              │  │
    │  │  PC4  ── ETH_RXD0             └───────────────┘              │  │
    │  │  PC5  ── ETH_RXD1                                             │  │
    │  │  PB13 ── ETH_TXD1                                             │  │
    │  │  PG11 ── ETH_TX_EN                                            │  │
    │  │  PG13 ── ETH_TXD0                                             │  │
    │  │                                                               │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │                                                                     │
    │  ┌─── USB OTG FS ───────────────────────────────────────────────┐  │
    │  │                                                               │  │
    │  │  PA8  ── USB_OTG_FS_SOF       ┌───────────────┐              │  │
    │  │  PA9  ── USB_OTG_FS_VBUS ────►│  USB Micro-B  │              │  │
    │  │  PA11 ── USB_OTG_FS_DM        │  (on-board)   │              │  │
    │  │  PA12 ── USB_OTG_FS_DP        └───────────────┘              │  │
    │  │  PD10 ── USB_PWR_EN                                           │  │
    │  │  PG7  ── USB_OVCR (EXTI7, overcurrent detect)                │  │
    │  │                                                               │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │                                                                     │
    │  ┌─── USART3 (ST-Link VCP / Debug Console) ────────────────────┐  │
    │  │                                                               │  │
    │  │  PD8  ── USART3_TX            ┌───────────────┐              │  │
    │  │  PD9  ── USART3_RX     ──────►│  ST-Link V3   │──► PC (USB) │  │
    │  │                                │  (on-board)   │              │  │
    │  │  Baud: 115200 (default)       └───────────────┘              │  │
    │  │                                                               │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │                                                                     │
    │  ┌─── USART2 (GPS u-blox) ─────────────────────────────────────┐  │
    │  │                                                               │  │
    │  │  PD5  ── USART2_TX            ┌───────────────┐              │  │
    │  │  PA3  ── USART2_RX     ──────►│  GPS u-blox   │              │  │
    │  │                                │  (UBX proto)  │              │  │
    │  │  Baud: 9600 → 38400           │  NMEA+UBX     │              │  │
    │  │  DMA1_Stream1 (RX circular)   │  4Hz rate     │              │  │
    │  │                                └───────────────┘              │  │
    │  │  Messaggi: GGA, RMC, VTG (on)                                 │  │
    │  │            GLL, GSA, GSV (off)                                 │  │
    │  │                                                               │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │                                                                     │
    │  ┌─── I2C1 (IMU ISM330 / LSM6DSOX) ───────────────────────────┐  │
    │  │                                                               │  │
    │  │  PB7  ── I2C1_SDA             ┌───────────────┐              │  │
    │  │  PB8  ── I2C1_SCL      ──────►│  ISM330DHCX   │              │  │
    │  │                                │  (IMU 6-axis) │              │  │
    │  │  Addr: 0x6B (o 0x6A)          │  Accel+Gyro   │              │  │
    │  │  Rate: 104 Hz                 │  ±2g / 2000dps│              │  │
    │  │  WHO_AM_I: 0x6B               └───────────────┘              │  │
    │  │                                                               │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │                                                                     │
    │  ┌─── SPI1 + CS (SD Card) ─────────────────────────────────────┐  │
    │  │                                                               │  │
    │  │  PA5  ── SPI1_SCK             ┌───────────────┐              │  │
    │  │  PA6  ── SPI1_MISO (pull-up)  │  MicroSD Card │              │  │
    │  │  PD7  ── SPI1_MOSI     ──────►│  (SPI mode)   │              │  │
    │  │  PA4  ── CS (GPIO Output)     │  FATFS        │              │  │
    │  │          (active LOW)         └───────────────┘              │  │
    │  │                                                               │  │
    │  │  Baud: ~390 KHz (prescaler 256)                               │  │
    │  │  Log: timestamp,ax,ay,az,wx,wy,wz,lat,lon,alt,travel         │  │
    │  │                                                               │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │                                                                     │
    │  ┌─── ADC3 (Sensore Corsa Sospensione) ────────────────────────┐  │
    │  │                                                               │  │
    │  │  PC2_C ── ADC3_INP0 (analog)  ┌───────────────┐              │  │
    │  │           (A4 su Nucleo) ────►│  Potenziometro │              │  │
    │  │                                │  lineare /     │              │  │
    │  │  12-bit, single-ended         │  sensore corsa │              │  │
    │  │  Lettura: 0 ~ 3.3V           │  sospensione   │              │  │
    │  │                                │  posteriore    │              │  │
    │  │                                └───────────────┘              │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │                                                                     │
    │  ┌─── LED ON-BOARD (BSP) ──────────────────────────────────────┐  │
    │  │                                                               │  │
    │  │  PB0  ── LED1 (GREEN)   🟢                                   │  │
    │  │  PE1  ── LED2 (YELLOW)  🟡                                   │  │
    │  │  PB14 ── LED3 (RED)     🔴                                   │  │
    │  │                                                               │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │                                                                     │
    │  ┌─── PULSANTE ON-BOARD (BSP) ─────────────────────────────────┐  │
    │  │                                                               │  │
    │  │  PC13 ── USER Button (EXTI13, active LOW)                     │  │
    │  │          → Ferma registrazione dati su SD                     │  │
    │  │                                                               │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    │                                                                     │
    │  ┌─── OSCILLATORI (on-board) ──────────────────────────────────┐  │
    │  │                                                               │  │
    │  │  PH0  ── HSE_IN  (oscillatore principale)                     │  │
    │  │  PH1  ── HSE_OUT                                              │  │
    │  │  PC14 ── LSE_IN  (32.768 kHz)                                 │  │
    │  │  PC15 ── LSE_OUT                                              │  │
    │  │                                                               │  │
    │  └───────────────────────────────────────────────────────────────┘  │
    │                                                                     │
    └─────────────────────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════════════════╗
║  RIEPILOGO PIN OCCUPATI (35 pin)                                               ║
╠══════════╦════════════════════╦════════════════════════════════════════════════╣
║  PIN     ║  TIPO              ║  FUNZIONE                                     ║
╠══════════╬════════════════════╬════════════════════════════════════════════════╣
║  PA1     ║  AF11 (ETH)        ║  ETH_REF_CLK                                 ║
║  PA2     ║  AF11 (ETH)        ║  ETH_MDIO                                    ║
║  PA3     ║  AF7  (USART2)     ║  USART2_RX  ← GPS                            ║
║  PA4     ║  GPIO Output       ║  SD Card CS (active LOW)                      ║
║  PA5     ║  AF5  (SPI1)       ║  SPI1_SCK   → SD Card                        ║
║  PA6     ║  AF5  (SPI1)       ║  SPI1_MISO  ← SD Card                        ║
║  PA7     ║  AF11 (ETH)        ║  ETH_CRS_DV                                  ║
║  PA8     ║  AF10 (USB)        ║  USB_OTG_FS_SOF                              ║
║  PA9     ║  AF10 (USB)        ║  USB_OTG_FS_VBUS                             ║
║  PA11    ║  AF10 (USB)        ║  USB_OTG_FS_DM                               ║
║  PA12    ║  AF10 (USB)        ║  USB_OTG_FS_DP                               ║
║  PB0     ║  GPIO Output       ║  LED1 GREEN  🟢                              ║
║  PB7     ║  AF4  (I2C1)       ║  I2C1_SDA   ↔ IMU                            ║
║  PB8     ║  AF4  (I2C1)       ║  I2C1_SCL   → IMU                            ║
║  PB13    ║  AF11 (ETH)        ║  ETH_TXD1                                    ║
║  PB14    ║  GPIO Output       ║  LED3 RED    🔴                              ║
║  PC1     ║  AF11 (ETH)        ║  ETH_MDC                                     ║
║  PC2_C   ║  Analog            ║  ADC3_INP0 ← Sensore corsa sospensione       ║
║  PC4     ║  AF11 (ETH)        ║  ETH_RXD0                                    ║
║  PC5     ║  AF11 (ETH)        ║  ETH_RXD1                                    ║
║  PC13    ║  GPIO Input (EXTI) ║  USER Button → stop registrazione             ║
║  PC14    ║  RCC               ║  OSC32_IN                                     ║
║  PC15    ║  RCC               ║  OSC32_OUT                                    ║
║  PD5     ║  AF7  (USART2)     ║  USART2_TX  → GPS                            ║
║  PD7     ║  AF5  (SPI1)       ║  SPI1_MOSI  → SD Card                        ║
║  PD8     ║  AF7  (USART3)     ║  USART3_TX  → ST-Link VCP                    ║
║  PD9     ║  AF7  (USART3)     ║  USART3_RX  ← ST-Link VCP                    ║
║  PD10    ║  GPIO Output       ║  USB_OTG_FS_PWR_EN                           ║
║  PE1     ║  GPIO Output       ║  LED2 YELLOW 🟡                              ║
║  PG7     ║  GPIO EXTI7        ║  USB_OTG_FS_OVCR                             ║
║  PG11    ║  AF11 (ETH)        ║  ETH_TX_EN                                   ║
║  PG13    ║  AF11 (ETH)        ║  ETH_TXD0                                    ║
║  PH0     ║  RCC               ║  HSE_IN                                       ║
║  PH1     ║  RCC               ║  HSE_OUT                                      ║
╠══════════╩════════════════════╩════════════════════════════════════════════════╣
║                                                                                ║
║  SOFTWARE: FreeRTOS (CMSIS v2) — MainTask logga a 200Hz su SD:                ║
║    timestamp, ax, ay, az, wx, wy, wz, lat, lon, alt_m, travel_rear_volt       ║
║    USER Button (PC13) → notifica task → chiude file e ferma log                ║
║                                                                                ║
╚══════════════════════════════════════════════════════════════════════════════════╝


    SCHEMA A BLOCCHI FISICO:

                                ┌──────────┐
                                │  GPS     │
                                │  u-blox  │
                                │          │
                                │ TX ── PA3│ (USART2_RX)
                                │ RX ── PD5│ (USART2_TX)
                                │ VCC  GND │
                                └──────────┘

    ┌──────────┐                                        ┌──────────┐
    │ IMU      │                                        │ SD Card  │
    │ISM330DHCX│                                        │ (SPI)    │
    │          │                                        │          │
    │ SDA ─ PB7│ (I2C1)                          PA5 ──│ CLK      │
    │ SCL ─ PB8│                                 PA6 ──│ MISO     │
    │ VCC  GND │                                 PD7 ──│ MOSI     │
    └──────────┘                                 PA4 ──│ CS       │
                                                       │ VCC  GND │
    ┌──────────────┐                                   └──────────┘
    │ Sensore Corsa│
    │ Sospensione  │
    │ (posteriore) │                    ┌──────────────────────────┐
    │              │                    │  NUCLEO-H755ZI-Q         │
    │ OUT ── PC2_C │ (ADC3)            │                          │
    │ VCC     GND  │                    │  🟢 PB0  (LED GREEN)    │
    └──────────────┘                    │  🟡 PE1  (LED YELLOW)   │
                                        │  🔴 PB14 (LED RED)      │
                                        │  🔘 PC13 (USER BUTTON)  │
                                        │                          │
                                        │  [ETH RJ45] [USB] [VCP] │
                                        └──────────────────────────┘




╔══════════════════════════════════════════════════════════════════════════════════╗
║          SCHEMA COMPLETO AGGIORNATO — NUOVI SENSORI DA AGGIUNGERE              ║
║                         NUCLEO-H755ZI-Q                                        ║
╚══════════════════════════════════════════════════════════════════════════════════╝



 1️⃣  SENSORE CORSA FORCELLA  (Potenziometro lineare, analogico)
 ═══════════════════════════════════════════════════════════════

         Potenziometro                    STM32
      ┌──────────────┐
      │              │
      │  +V ─────────┼──────────────── 3.3V
      │              │
      │  WIPER ──────┼──────────────── PC3_C  (ADC3_INP1)
      │              │
      │  GND ────────┼──────────────── GND
      │              │
      └──────────────┘

      Identico al sensore corsa posteriore (PC2_C / ADC3_INP0).
      Stesso ADC3, canale adiacente → lettura sequenziale.
      Ricorda: abilitare switch analogico SYSCFG_PMCR_PC3SO.



 2️⃣  IMU #2 — ISM330DHCX  (bus I2C4 separato)
 ═══════════════════════════════════════════════

         ISM330DHCX #2                    STM32
      ┌──────────────┐
      │              │
      │  VCC ────────┼──────────────── 3.3V
      │              │
      │  GND ────────┼──────────────── GND
      │              │     4.7kΩ
      │  SCL ────────┼────┤├────────── PF14  (I2C4_SCL, AF4)
      │              │     4.7kΩ
      │  SDA ────────┼────┤├────────── PF15  (I2C4_SDA, AF4)
      │              │
      │  SDO/SA0 ────┼──────────────── GND  → indirizzo 0x6A
      │              │
      │  INT1 ───────┼──────────────── PE2  (GPIO EXTI, opzionale)
      │              │
      └──────────────┘

      IMU #1 (esistente): I2C1, PB7/PB8, addr 0x6B (SDO=VCC)
      IMU #2 (nuovo):     I2C4, PF14/PF15, addr 0x6A (SDO=GND)
      Bus separato → zero conflitti, cavi indipendenti.



 3️⃣  IMU #3 — ISM330DHCX  (opzionale, bus I2C2)
 ════════════════════════════════════════════════

         ISM330DHCX #3                    STM32
      ┌──────────────┐
      │              │
      │  VCC ────────┼──────────────── 3.3V
      │              │
      │  GND ────────┼──────────────── GND
      │              │     4.7kΩ
      │  SCL ────────┼────┤├────────── PB10  (I2C2_SCL, AF4)
      │              │     4.7kΩ
      │  SDA ────────┼────┤├────────── PB11  (I2C2_SDA, AF4)
      │              │
      │  SDO/SA0 ────┼──────────────── GND o 3.3V (0x6A o 0x6B)
      │              │
      │  INT1 ───────┼──────────────── PE3  (GPIO EXTI, opzionale)
      │              │
      └──────────────┘

      Bus I2C2 completamente indipendente da I2C1 e I2C4.



 4️⃣  SENSORE VELOCITÀ RUOTA ANTERIORE  (US1881 Hall digitale + magnete)
 ══════════════════════════════════════════════════════════════════════

         US1881                           STM32
      ┌──────────────┐
      │              │
      │  VCC ────────┼──────────────── 3.3V
      │              │
      │  GND ────────┼──────────────── GND
      │              │
      │  OUT ────────┼──────────────── PE6  (GPIO EXTI / TIM Input Capture)
      │              │
      └──────────────┘

      + Magnete neodimio 8×3mm sul disco freno (1-4 magneti)

      Ogni passaggio magnete → fronte sul pin → interrupt
      Calcolo: velocità = circonferenza_ruota / delta_tempo_tra_impulsi

      US1881 è push-pull → non serve pull-up esterno.
      Se usi A3144 (open-drain) → aggiungi pull-up 10kΩ a 3.3V.



 5️⃣  SENSORE LEVA FRENO ANTERIORE  (SS49E Hall lineare + magnete)
 ═══════════════════════════════════════════════════════════════════

         SS49E                            STM32
      ┌──────────────┐
      │              │
      │  VCC ────────┼──────────────── 3.3V
      │              │
      │  OUT ────────┼──────────────── PB1  (ADC1_INP5)
      │              │
      │  GND ────────┼──────────────── GND
      │              │
      └──────────────┘

      + Magnete neodimio 5×2mm incollato sulla leva freno

      Leva rilasciata:  magnete lontano → ~1.6V
      Leva metà corsa:  magnete medio   → ~2.2V
      Leva a fondo:     magnete vicino  → ~2.8V



 6️⃣  SENSORE LEVA FRENO POSTERIORE  (SS49E Hall lineare + magnete)
 ═══════════════════════════════════════════════════════════════════

         SS49E                            STM32
      ┌──────────────┐
      │              │
      │  VCC ────────┼──────────────── 3.3V
      │              │
      │  OUT ────────┼──────────────── PA0  (ADC1_INP16)
      │              │
      │  GND ────────┼──────────────── GND
      │              │
      └──────────────┘

      + Magnete neodimio 5×2mm incollato sulla leva/pedale freno

      Stesso principio del freno anteriore.



╔══════════════════════════════════════════════════════════════════════════════════╗
║                    SCHEMA A BLOCCHI COMPLETO                                    ║
║               (esistente + nuovo, tutto insieme)                                ║
╚══════════════════════════════════════════════════════════════════════════════════╝


                              ┌──────────┐
                              │  GPS     │
                              │  u-blox  │
                              │ TX → PA3 │ (USART2_RX)
                              │ RX → PD5 │ (USART2_TX)
                              └──────────┘

  ┌──────────┐                                          ┌──────────┐
  │ IMU #1   │                                          │ SD Card  │
  │ISM330DHCX│                                          │ (SPI1)   │
  │ I2C1     │                                   PA5 ──│ CLK      │
  │ SDA → PB7│                                   PA6 ──│ MISO     │
  │ SCL → PB8│                                   PD7 ──│ MOSI     │
  │ addr 0x6B│                                   PA4 ──│ CS       │
  └──────────┘                                          └──────────┘

  ┌──────────┐    ┌──────────┐
  │ IMU #2   │    │ IMU #3   │
  │ISM330DHCX│    │ISM330DHCX│       ┌──────────────────────────────────┐
  │ I2C4     │    │ I2C2     │       │                                  │
  │SDA→ PF15 │    │SDA→ PB11 │       │      NUCLEO-H755ZI-Q            │
  │SCL→ PF14 │    │SCL→ PB10 │       │                                  │
  │ addr 0x6A│    │ addr 0x6A│       │  🟢 PB0  (LED GREEN)            │
  └──────────┘    └──────────┘       │  🟡 PE1  (LED YELLOW)           │
                                      │  🔴 PB14 (LED RED)              │
  ┌──────────────┐                    │  🔘 PC13 (USER BUTTON)          │
  │ Corsa        │                    │                                  │
  │ Posteriore   │                    │  [ETH RJ45] [USB] [VCP/Debug]   │
  │ (ammort.)    │                    │                                  │
  │ OUT → PC2_C  │ (ADC3_INP0)       └──────────────────────────────────┘
  └──────────────┘

  ┌──────────────┐                    ┌──────────────┐
  │ Corsa        │                    │ Velocità     │
  │ Forcella     │                    │ Ruota Ant.   │
  │ (fork)       │                    │ US1881+magn. │
  │ OUT → PC3_C  │ (ADC3_INP1)       │ OUT → PE6    │ (GPIO EXTI)
  └──────────────┘                    └──────────────┘

  ┌──────────────┐                    ┌──────────────┐
  │ Freno Ant.   │                    │ Freno Post.  │
  │ SS49E+magn.  │                    │ SS49E+magn.  │
  │ OUT → PB1    │ (ADC1_INP5)       │ OUT → PA0    │ (ADC1_INP16)
  └──────────────┘                    └──────────────┘



╔══════════════════════════════════════════════════════════════════════════════════╗
║                    TABELLA PIN COMPLETA (ESISTENTI + NUOVI)                     ║
╠══════════╦════════════════════╦═══════════════════════════════════════════════╣
║  PIN     ║  PERIFERICA        ║  FUNZIONE                                    ║
╠══════════╬════════════════════╬═══════════════════════════════════════════════╣
║          ║   — ESISTENTI —    ║                                              ║
║  PA1     ║  AF11 (ETH)        ║  ETH_REF_CLK                                ║
║  PA2     ║  AF11 (ETH)        ║  ETH_MDIO                                   ║
║  PA3     ║  AF7  (USART2)     ║  USART2_RX ← GPS                            ║
║  PA4     ║  GPIO Output       ║  SD Card CS                                  ║
║  PA5     ║  AF5  (SPI1)       ║  SPI1_SCK → SD Card                         ║
║  PA6     ║  AF5  (SPI1)       ║  SPI1_MISO ← SD Card                        ║
║  PA7     ║  AF11 (ETH)        ║  ETH_CRS_DV                                 ║
║  PA8     ║  AF10 (USB)        ║  USB_OTG_FS_SOF                             ║
║  PA9     ║  AF10 (USB)        ║  USB_OTG_FS_VBUS                            ║
║  PA11    ║  AF10 (USB)        ║  USB_OTG_FS_DM                              ║
║  PA12    ║  AF10 (USB)        ║  USB_OTG_FS_DP                              ║
║  PB0     ║  GPIO Output       ║  LED1 GREEN 🟢                              ║
║  PB7     ║  AF4  (I2C1)       ║  I2C1_SDA ↔ IMU #1                          ║
║  PB8     ║  AF4  (I2C1)       ║  I2C1_SCL → IMU #1                          ║
║  PB13    ║  AF11 (ETH)        ║  ETH_TXD1                                   ║
║  PB14    ║  GPIO Output       ║  LED3 RED 🔴                                ║
║  PC1     ║  AF11 (ETH)        ║  ETH_MDC                                    ║
║  PC2_C   ║  Analog (ADC3)     ║  ADC3_INP0 ← Corsa sospensione POST        ║
║  PC4     ║  AF11 (ETH)        ║  ETH_RXD0                                   ║
║  PC5     ║  AF11 (ETH)        ║  ETH_RXD1                                   ║
║  PC13    ║  GPIO Input (EXTI) ║  USER Button                                 ║
║  PC14    ║  RCC               ║  OSC32_IN                                    ║
║  PC15    ║  RCC               ║  OSC32_OUT                                   ║
║  PD5     ║  AF7  (USART2)     ║  USART2_TX → GPS                            ║
║  PD7     ║  AF5  (SPI1)       ║  SPI1_MOSI → SD Card                        ║
║  PD8     ║  AF7  (USART3)     ║  USART3_TX → ST-Link VCP                    ║
║  PD9     ║  AF7  (USART3)     ║  USART3_RX ← ST-Link VCP                    ║
║  PD10    ║  GPIO Output       ║  USB_OTG_FS_PWR_EN                          ║
║  PE1     ║  GPIO Output       ║  LED2 YELLOW 🟡                             ║
║  PG7     ║  GPIO EXTI7        ║  USB_OTG_FS_OVCR                            ║
║  PG11    ║  AF11 (ETH)        ║  ETH_TX_EN                                  ║
║  PG13    ║  AF11 (ETH)        ║  ETH_TXD0                                   ║
║  PH0     ║  RCC               ║  HSE_IN                                      ║
║  PH1     ║  RCC               ║  HSE_OUT                                     ║
╠══════════╬════════════════════╬═══════════════════════════════════════════════╣
║          ║   — NUOVI —        ║                                              ║
║  PC3_C   ║  Analog (ADC3)     ║  ADC3_INP1 ← Corsa forcella (pot. lineare)  ║
║  PF14    ║  AF4  (I2C4)       ║  I2C4_SCL → IMU #2                          ║
║  PF15    ║  AF4  (I2C4)       ║  I2C4_SDA ↔ IMU #2                          ║
║  PB10    ║  AF4  (I2C2)       ║  I2C2_SCL → IMU #3 (opzionale)              ║
║  PB11    ║  AF4  (I2C2)       ║  I2C2_SDA ↔ IMU #3 (opzionale)              ║
║  PE6     ║  GPIO EXTI         ║  Velocità ruota ant. (US1881 Hall digitale)  ║
║  PB1     ║  Analog (ADC1)     ║  ADC1_INP5 ← Freno ant. (SS49E Hall lin.)   ║
║  PA0     ║  Analog (ADC1)     ║  ADC1_INP16 ← Freno post. (SS49E Hall lin.) ║
║  PE2     ║  GPIO EXTI         ║  INT1 IMU #2 (opzionale)                     ║
║  PE3     ║  GPIO EXTI         ║  INT1 IMU #3 (opzionale)                     ║
╠══════════╩════════════════════╩═══════════════════════════════════════════════╣
║  TOTALE PIN USATI: ~44 su 144  —  ANCORA ~70% LIBERI ✅                      ║
╚══════════════════════════════════════════════════════════════════════════════════╝



╔══════════════════════════════════════════════════════════════════════════════════╗
║                    LISTA DELLA SPESA COMPLETA NUOVI SENSORI                    ║
╠═══════════════════════════════════════╦═══════╦═══════════╦════════════════════╣
║  Componente                           ║  Qtà  ║  Costo    ║  Per cosa          ║
╠═══════════════════════════════════════╬═══════╬═══════════╬════════════════════╣
║  Potenziometro lineare 10-50mm        ║   1   ║  ~3-5€    ║  Corsa forcella    ║
║  ISM330DHCX breakout                  ║  1-2  ║  ~8-12€   ║  IMU #2 (#3)       ║
║  US1881 (Hall digitale latching)      ║   1   ║  ~0.50€   ║  Velocità ruota    ║
║  SS49E  (Hall lineare analogico)      ║   2   ║  ~2€      ║  Freni ant.+post.  ║
║  Magnete neodimio 8×3mm              ║  1-4  ║  ~1-2€    ║  Ruota anteriore   ║
║  Magnete neodimio 5×2mm             ║   2   ║  ~1€      ║  Leve freni        ║
║  Resistenze 4.7kΩ (pull-up I2C)     ║   4   ║  ~0.20€   ║  I2C4 (e I2C2)     ║
║  Cavo schermato 3 fili (2m)          ║   3   ║  ~3€      ║  Sensori analogici  ║
║  Cavo schermato 2 fili (1.5m)        ║   2   ║  ~2€      ║  Hall digitali      ║
║  Connettori JST-XH 3 pin            ║   5   ║  ~2€      ║  Collegamenti       ║
╠═══════════════════════════════════════╬═══════╬═══════════╬════════════════════╣
║  TOTALE (con 2 IMU)                  ║       ║  ~25-30€  ║                    ║
║  TOTALE (con 3 IMU)                  ║       ║  ~35-40€  ║                    ║
╚═══════════════════════════════════════╩═══════╩═══════════╩════════════════════╝