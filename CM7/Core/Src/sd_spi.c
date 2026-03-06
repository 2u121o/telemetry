#include "sd_spi.h"
#include "spi.h"
#include "gpio.h"
#include "stm32h7xx_hal.h"
#include <stdio.h>

// variabili statiche
static int g_is_sdhc = 0;

// helper per CS
static inline void SD_CS_L(void){ HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, GPIO_PIN_RESET); }
static inline void SD_CS_H(void){ HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, GPIO_PIN_SET); }

static void sd_spi_set_low_speed(void)
{
    HAL_SPI_DeInit(&hspi1);
    hspi1.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_256; // ~400 kHz
    hspi1.Init.CLKPolarity = SPI_POLARITY_LOW;                 // Mode 0
    hspi1.Init.CLKPhase    = SPI_PHASE_1EDGE;
    hspi1.Init.NSS         = SPI_NSS_SOFT;
    HAL_SPI_Init(&hspi1);
}

static void sd_spi_set_high_speed(void)
{
    HAL_SPI_DeInit(&hspi1);
    hspi1.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_8;    // alza pure a 4/2 se regge
    hspi1.Init.CLKPolarity = SPI_POLARITY_LOW;
    hspi1.Init.CLKPhase    = SPI_PHASE_1EDGE;
    hspi1.Init.NSS         = SPI_NSS_SOFT;
    HAL_SPI_Init(&hspi1);
}

// funzione spi
static uint8_t spi_txrx(uint8_t b){
    uint8_t rx=0xFF;
    HAL_SPI_TransmitReceive(&hspi1, &b, &rx, 1, 2);
    return rx;
}

static uint8_t sd_cmd_raw(uint8_t cmd, uint32_t arg, uint8_t crc, uint8_t *r1)
{
  uint8_t resp = 0xFF;

  SD_CS_L();
  spi_txrx(0xFF);                 // 1 gap byte

  spi_txrx(0x40 | cmd);
  spi_txrx((arg >> 24) & 0xFF);
  spi_txrx((arg >> 16) & 0xFF);
  spi_txrx((arg >> 8)  & 0xFF);
  spi_txrx(arg & 0xFF);
  spi_txrx(crc);

  // leggi R1 (max ~8 try)
  uint32_t t1 = HAL_GetTick();
  for (;;) {
      resp = spi_txrx(0xFF);
      if ((resp & 0x80) == 0) break;        // ricevuto R1 valido
      if ((HAL_GetTick() - t1) > 20) break; // timeout 20 ms
  }
  *r1 = resp;
  return resp;
}

static uint8_t sd_cmd(uint8_t cmd, uint32_t arg, uint8_t crc, uint8_t *r1)
{
  uint8_t resp = sd_cmd_raw(cmd, arg, crc, r1);
  SD_CS_H();
  spi_txrx(0xFF);                 // post clock
  return resp;
}

static int sd_acmd41(uint32_t hcs)  // hcs=1 per SDHC/SDXC
{
  uint8_t r1;
  // CMD55
  sd_cmd(55, 0, 0x65, &r1);
  // ACMD41 con HCS nel bit 30
  return sd_cmd(41, hcs ? 0x40000000 : 0x00000000, 0x77, &r1), r1;
}

void sd_idle_clocks(uint32_t nbytes){
 SD_CS_H();
 for(uint32_t i=0;i<nbytes;i++) spi_txrx(0xFF);
}

//// Inizializzazione completa in SPI mode

int sd_init(void)
{
  static int s_inited = 0;
  if (s_inited) return 0;

  printf("[SD] init start\r\n");
  sd_spi_set_low_speed();
  SD_CS_H();
//  HAL_Delay(2);

  // 80+ clock a CS alto
  sd_idle_clocks(20);

  uint8_t r1;

  printf("[SD] CMD0...\r\n");
  sd_cmd(0, 0x00000000, 0x95, &r1);
  printf("[SD] CMD0 R1=0x%02X\r\n", r1);
  if (r1 != 0x01 && r1 != 0x00) {
	printf("[SD] CMD0 bad R1\r\n");
	return -10;
  }

  printf("[SD] CMD8...\r\n");
  sd_cmd_raw(8, 0x000001AA, 0x87, &r1);
  uint8_t r7[4] = { spi_txrx(0xFF), spi_txrx(0xFF), spi_txrx(0xFF), spi_txrx(0xFF) };
  SD_CS_H(); spi_txrx(0xFF);
  printf("[SD] CMD8 R1=0x%02X R7=%02X %02X %02X %02X\r\n", r1, r7[0], r7[1], r7[2], r7[3]);

  printf("[SD] ACMD41 loop...\r\n");
  uint32_t tmo = 2000; // ~2s totali
  do {
	r1 = sd_acmd41(1);
	if (r1 == 0x00) break;
	HAL_Delay(2);
  } while (tmo--);
  printf("[SD] ACMD41 R1=0x%02X\r\n", r1);
  if (r1 != 0x00) {
	printf("[SD] ACMD41 timeout\r\n");
	return -11;
  }

  printf("[SD] CMD58...\r\n");
  sd_cmd_raw(58, 0, 0xFD, &r1);
  uint8_t ocr[4] = { spi_txrx(0xFF), spi_txrx(0xFF), spi_txrx(0xFF), spi_txrx(0xFF) };
  SD_CS_H(); spi_txrx(0xFF);
  printf("[SD] CMD58 R1=0x%02X OCR=%02X %02X %02X %02X\r\n", r1, ocr[0], ocr[1], ocr[2], ocr[3]);

  g_is_sdhc = (ocr[0] & 0x40) ? 1 : 0;
  if (!g_is_sdhc) {
	printf("[SD] CMD16 512...\r\n");
	sd_cmd(16, 512, 0x15, &r1);
	printf("[SD] CMD16 R1=0x%02X\r\n", r1);
	if (r1 != 0x00) return -12;
  }

  sd_spi_set_high_speed();
  s_inited = 1;
  printf("[SD] init done\r\n");
  return 0;
}


int sd_write_block(uint32_t lba, const uint8_t *buf)
{
    uint8_t r1;

    // Argomento: SDHC/SDXC = block addressing; SDSC = byte addressing
    uint32_t arg = g_is_sdhc ? lba : (lba * 512u);

    SD_CS_L();
    spi_txrx(0xFF); // gap

    sd_cmd_raw(24, arg, 0xFF, &r1);  // CMD24 = write single block
    if (r1 != 0x00) {
        SD_CS_H(); spi_txrx(0xFF);
        printf("CMD24 fail r1=0x%02X\r\n", r1);
        return -1;
    }

    // Start token
    spi_txrx(0xFE);

    // Data 512B
    for (int i=0; i<512; i++) spi_txrx(buf[i]);

    // CRC dummy
    spi_txrx(0xFF); spi_txrx(0xFF);

    // Data response
    uint8_t resp = spi_txrx(0xFF);
    if ((resp & 0x1F) != 0x05) { // 0bxxx0101 = data accepted
        SD_CS_H(); spi_txrx(0xFF);
        printf("Write data resp=0x%02X\r\n", resp);
        return -2;
    }

    // Attendi fine busy (MISO=0 finché scrive)
    int wait=0xFFFFFF;
    while (wait-- > 0) {
        uint8_t b = spi_txrx(0xFF);
        if (b==0xFF) break;
    }

    SD_CS_H();
    spi_txrx(0xFF);
    return 0;
}

// Lettura di un blocco (LBA) in 512B buffer
 int sd_read_block(uint32_t lba, uint8_t *buf)
{
	uint8_t r1;

	  // Argomento: SDHC/SDXC = block addressing; SDSC = byte addressing
	  uint32_t arg = g_is_sdhc ? lba : (lba * 512u);

	  SD_CS_L();
	  spi_txrx(0xFF);                         // gap

	  sd_cmd_raw(17, arg, 0xFF, &r1);         // CMD17
	  if (r1 != 0x00) {
	    SD_CS_H(); spi_txrx(0xFF);
	    printf("CMD17 R1=0x%02X\r\n", r1);
	    return -1;
	  }

	  // Attesa token 0xFE (può richiedere molti byte; aumentiamo la finestra)
	  uint8_t tok = 0xFF;
	  int wait = 800000;                      // ~ampio timeout a byte dummy
	  while (wait-- > 0) {
	     tok = spi_txrx(0xFF);
	     if (tok == 0xFE) break;
	     if ((wait & 0xFF) == 0) HAL_Delay(1);   // ogni tanto respira
	   }
	  if (tok != 0xFE) {
	    SD_CS_H(); spi_txrx(0xFF);
	    printf("No data token, tok=0x%02X\r\n", tok);
	    return -2;
	  }

	  // Leggi 512B
	  for (int i=0; i<512; i++) buf[i] = spi_txrx(0xFF);

	  // CRC (2B) ignorato
	  spi_txrx(0xFF); spi_txrx(0xFF);

	  SD_CS_H(); spi_txrx(0xFF);              // post-clock
	  return 0;
}
