/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.c
  * @brief          : Main program body
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2024 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */
/* USER CODE END Header */
/* Includes ------------------------------------------------------------------*/
#include "main.h"
#include "cmsis_os.h"
#include "dma.h"
#include "fatfs.h"
#include "i2c.h"
#include "spi.h"
#include "usart.h"
#include "gpio.h"
#include "sd_spi.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include <stdio.h>
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */

typedef struct tagButtonMessage
{
  Button_TypeDef buttonType;
  uint16_t buttonState;
} ButtonMessage_t;

extern UART_HandleTypeDef huart3;
extern char USERPath[4];

static int g_is_sdhc = 0;
/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */

// Chip Select PA4 helper
//static inline void SD_CS_L(void){ HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, GPIO_PIN_RESET); }
//static inline void SD_CS_H(void){ HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, GPIO_PIN_SET); }

// SPI byte xfer
//static uint8_t spi_txrx(uint8_t b){
//  uint8_t rx=0xFF;
//  HAL_SPI_TransmitReceive(&hspi1, &b, &rx, 1, 100);
//  return rx;
//}

//static uint8_t sd_cmd_raw(uint8_t cmd, uint32_t arg, uint8_t crc, uint8_t *r1)
//{
//  uint8_t resp = 0xFF;
//
//  SD_CS_L();
//  spi_txrx(0xFF);                 // 1 gap byte
//
//  spi_txrx(0x40 | cmd);
//  spi_txrx((arg >> 24) & 0xFF);
//  spi_txrx((arg >> 16) & 0xFF);
//  spi_txrx((arg >> 8)  & 0xFF);
//  spi_txrx(arg & 0xFF);
//  spi_txrx(crc);
//
//  // leggi R1 (max ~8 try)
//  for (int i=0; i<64; i++) {
//    resp = spi_txrx(0xFF);
//    if ((resp & 0x80) == 0) break;
//  }
//
//  *r1 = resp;
//  return resp;
//}

//static uint8_t sd_cmd(uint8_t cmd, uint32_t arg, uint8_t crc, uint8_t *r1)
//{
//  uint8_t resp = sd_cmd_raw(cmd, arg, crc, r1);
//  SD_CS_H();
//  spi_txrx(0xFF);                 // post clock
//  return resp;
//}
//
//static int sd_acmd41(uint32_t hcs)  // hcs=1 per SDHC/SDXC
//{
//  uint8_t r1;
//  // CMD55
//  sd_cmd(55, 0, 0x65, &r1);
//  // ACMD41 con HCS nel bit 30
//  return sd_cmd(41, hcs ? 0x40000000 : 0x00000000, 0x77, &r1), r1;
//}

//// Inizializzazione completa in SPI mode
// int sd_init(void)
//{
//  // 80+ clocks a CS alto
//  sd_idle_clocks(20);
//
//  uint8_t r1;
//  // CMD0: IDLE (0x01) atteso, ma 0x00 = già pronto -> OK
//  sd_cmd(0, 0x00000000, 0x95, &r1);
//  printf("CMD0 R1=0x%02X\r\n", r1);
//
//  // CMD8: tensione / check SDHC (pattern 0x1AA)
//  sd_cmd_raw(8, 0x000001AA, 0x87, &r1);
//  // leggi resto R7 (4 byte) mentre CS è LOW
//  uint8_t r7[4] = { spi_txrx(0xFF), spi_txrx(0xFF), spi_txrx(0xFF), spi_txrx(0xFF) };
//  SD_CS_H(); spi_txrx(0xFF);
//  printf("CMD8 R1=0x%02X, R7=%02X %02X %02X %02X\r\n", r1, r7[0],r7[1],r7[2],r7[3]);
//
//  // ACMD41 loop finché R1 = 0x00 (esce dallo stato idle)
//  for (int i=0; i<2000; i++) {             // ~1s
//    r1 = sd_acmd41(1);
//    if (r1 == 0x00) break;
//    HAL_Delay(1);
//  }
//  printf("ACMD41 R1=0x%02X\r\n", r1);
//  if (r1 != 0x00) return -1;
//
//  // CMD58: OCR (per verificare CCS)
//  sd_cmd_raw(58, 0, 0xFD, &r1);
//  uint8_t ocr[4] = { spi_txrx(0xFF), spi_txrx(0xFF), spi_txrx(0xFF), spi_txrx(0xFF) };
//  SD_CS_H(); spi_txrx(0xFF);
//  printf("CMD58 R1=0x%02X, OCR=%02X %02X %02X %02X\r\n", r1, ocr[0],ocr[1],ocr[2],ocr[3]);
//
//  g_is_sdhc = (ocr[0] & 0x40) ? 1 : 0;   // bit CCS
//
//  // (solo SDSC) CMD16 per block size 512
//  if (!g_is_sdhc) {
//    sd_cmd(16, 512, 0x15, &r1);
//    printf("CMD16 R1=0x%02X\r\n", r1);
//    if (r1 != 0x00) return -2;
//  }
//
//  return 0;
//}

//// Lettura di un blocco (LBA) in 512B buffer
// int sd_read_block(uint32_t lba, uint8_t *buf)
//{
//	uint8_t r1;
//
//	  // Argomento: SDHC/SDXC = block addressing; SDSC = byte addressing
//	  uint32_t arg = g_is_sdhc ? lba : (lba * 512u);
//
//	  SD_CS_L();
//	  spi_txrx(0xFF);                         // gap
//
//	  sd_cmd_raw(17, arg, 0xFF, &r1);         // CMD17
//	  if (r1 != 0x00) {
//	    SD_CS_H(); spi_txrx(0xFF);
//	    printf("CMD17 R1=0x%02X\r\n", r1);
//	    return -1;
//	  }
//
//	  // Attesa token 0xFE (può richiedere molti byte; aumentiamo la finestra)
//	  uint8_t tok = 0xFF;
//	  int wait = 800000;                      // ~ampio timeout a byte dummy
//	  while (wait-- > 0) {
//	    tok = spi_txrx(0xFF);
//	    if (tok == 0xFE) break;               // token dati
//	  }
//	  if (tok != 0xFE) {
//	    SD_CS_H(); spi_txrx(0xFF);
//	    printf("No data token, tok=0x%02X\r\n", tok);
//	    return -2;
//	  }
//
//	  // Leggi 512B
//	  for (int i=0; i<512; i++) buf[i] = spi_txrx(0xFF);
//
//	  // CRC (2B) ignorato
//	  spi_txrx(0xFF); spi_txrx(0xFF);
//
//	  SD_CS_H(); spi_txrx(0xFF);              // post-clock
//	  return 0;
//}



// Clocks “dummy” a CS alto
// void sd_idle_clocks(uint32_t nbytes){
//  SD_CS_H();
//  for(uint32_t i=0;i<nbytes;i++) spi_txrx(0xFF);
//}

// Manda un comando SD (CMDx) e legge R1
// static uint8_t sd_cmd(uint8_t cmd, uint32_t arg, uint8_t crc){
//  uint8_t r1 = 0xFF;
//
//  SD_CS_L();
//  // 1 byte “gap”
//  spi_txrx(0xFF);
//
//  // pacchetto comando (6 byte)
//  spi_txrx(0x40 | cmd);
//  spi_txrx((arg >> 24) & 0xFF);
//  spi_txrx((arg >> 16) & 0xFF);
//  spi_txrx((arg >> 8) & 0xFF);
//  spi_txrx(arg & 0xFF);
//  spi_txrx(crc);
//
//  // leggi R1 (fino a 8 tentativi)
//  for(int i=0;i<8;i++){
//    r1 = spi_txrx(0xFF);
//    if ((r1 & 0x80) == 0) break;
//  }
//
//  SD_CS_H();
//  spi_txrx(0xFF); // post-clock
//  return r1;
//}

//void sd_quick_test(void){
//  // 80 clock a CS alto (richiesto dallo standard)
//  sd_idle_clocks(10);
//
//  // CMD0 (GO_IDLE_STATE), arg=0, CRC valido 0x95
//  uint8_t r1 = sd_cmd(0, 0x00000000, 0x95);
//  if (r1 == 0x01){
//    printf("SD CMD0 OK, R1=0x%02X (IDLE)\r\n", r1);
//  }else{
//    printf("SD CMD0 FAIL, R1=0x%02X\r\n", r1);
//  }
//
//  // (Opz.) CMD8 per voltaggio/SDHC check: CRC 0x87 con arg 0x1AA
//  // uint8_t r1_8 = sd_cmd(8, 0x000001AA, 0x87);
//  // printf("SD CMD8 R1=0x%02X\r\n", r1_8);
//}

#ifndef HSEM_ID_0
#define HSEM_ID_0 (0U) /* HW semaphore 0*/
#endif

/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

#ifdef __GNUC__
/* With GCC, small printf (option LD Linker->Libraries->Small printf
   set to 'Yes') calls __io_putchar() */
#define PUTCHAR_PROTOTYPE int __io_putchar(int ch)
#else
#define PUTCHAR_PROTOTYPE int fputc(int ch, FILE *f)
#endif /* __GNUC__ */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/

__IO uint32_t BspButtonState = BUTTON_RELEASED;

/* USER CODE BEGIN PV */

#define COUNTOF(__BUFFER__)   (sizeof(__BUFFER__) / sizeof(*(__BUFFER__)))
#define UART_DMA_RX_BUFFER_SIZE 64

/**
  * @brief Text strings printed on PC Com port for user information
  */
uint8_t aTextInfoStart[] = "\r\nUSART Example : Enter characters to fill reception buffers.\r\n";

uint8_t aRXBufferUser[UART_DMA_RX_BUFFER_SIZE];

/**
  * @brief Data buffers used to manage received data in interrupt routine
  */
uint8_t aRXBufferA[UART_DMA_RX_BUFFER_SIZE];
uint8_t aRXBufferB[UART_DMA_RX_BUFFER_SIZE];

uint32_t uwNbReceivedChars;
uint8_t *pBufferReadyForUser;
uint8_t *pBufferReadyForReception;

/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
void MX_FREERTOS_Init(void);
/* USER CODE BEGIN PFP */
void PrintInfo(UART_HandleTypeDef *huart, uint8_t *String, uint16_t Size);
void StartReception(UART_HandleTypeDef *huart);
void UserDataTreatment(UART_HandleTypeDef *huart, uint8_t* pData, uint16_t Size);
void UartRxCheck(UART_HandleTypeDef *huart, uint16_t Size);
/* USER CODE END PFP */

/* Private user code ---------------------------------------------------------*/
/* USER CODE BEGIN 0 */

#define IMU_ADDR_6A        (0x6A << 1)   // solo se SA0=0
#define IMU_ADDR_6B        (0x6B << 1)
#define WHO_AM_I_REG       0x0F          // atteso 0x6B
#define CTRL1_XL           0x10
#define CTRL2_G            0x11
#define CTRL3_C            0x12
#define OUTX_L_A           0x28          // accel start (auto-increment ON)

#define LSM6DSOX_ADDR       (0x6B << 1)     // 8-bit per HAL
#define LSM6DSOX_WHOAMI     0x0F
#define LSM6DSOX_CTRL1_XL   0x10
#define LSM6DSOX_CTRL2_G    0x11
#define LSM6DSOX_CTRL3_C    0x12
#define LSM6DSOX_OUTX_L_A   0x28   // accel data start (auto-increment ON)

void BSP_PB_Callback(Button_TypeDef Button)
{

  if (Button == BUTTON_USER)
  {
    BspButtonState = BUTTON_PRESSED;
  }
}

void HAL_GPIO_EXTI_Callback(uint16_t GPIO_Pin)
{
  if (GPIO_Pin == 13u) {
    BSP_PB_Callback(BUTTON_USER);
  }
}


//void HAL_GPIO_EXTI_Callback(uint16_t GPIO_Pin)
//{
//
//  if (GPIO_Pin == BUTTON_USER) {   // di solito GPIO_PIN_13
//    BspButtonState = BUTTON_PRESSED;
//  }
//}

static uint16_t lsm_addr = (0x6A<<1); // default

static uint16_t imu_addr = IMU_ADDR_6B;

static int imu_pick_addr(void) {
  if (HAL_I2C_IsDeviceReady(&hi2c1, IMU_ADDR_6B, 2, 50) == HAL_OK) { imu_addr = IMU_ADDR_6B; return 0; }
  if (HAL_I2C_IsDeviceReady(&hi2c1, IMU_ADDR_6A, 2, 50) == HAL_OK) { imu_addr = IMU_ADDR_6A; return 0; }
  return -1;
}

static int pick_addr(void){
  if (HAL_I2C_IsDeviceReady(&hi2c1, (0x6A<<1), 2, 50) == HAL_OK) { lsm_addr=(0x6A<<1); return 0; }
  if (HAL_I2C_IsDeviceReady(&hi2c1, (0x6B<<1), 2, 50) == HAL_OK) { lsm_addr=(0x6B<<1); return 0; }
  return -1;
}
#define LSM6DSOX_ADDR lsm_addr

static HAL_StatusTypeDef imu_read_u8(uint8_t reg, uint8_t *val) {
  return HAL_I2C_Mem_Read(&hi2c1, imu_addr, reg, I2C_MEMADD_SIZE_8BIT, val, 1, 100);
}
static HAL_StatusTypeDef imu_write_u8(uint8_t reg, uint8_t val) {
  return HAL_I2C_Mem_Write(&hi2c1, imu_addr, reg, I2C_MEMADD_SIZE_8BIT, &val, 1, 100);
}

//// Leggi 1 registro
//static HAL_StatusTypeDef lsm_read_u8(uint8_t reg, uint8_t *val) {
//  return HAL_I2C_Mem_Read(&hi2c1, LSM6DSOX_ADDR, reg, I2C_MEMADD_SIZE_8BIT, val, 1, 100);
//}
//
//// Scrivi 1 registro
//static HAL_StatusTypeDef lsm_write_u8(uint8_t reg, uint8_t val) {
//  return HAL_I2C_Mem_Write(&hi2c1, LSM6DSOX_ADDR, reg, I2C_MEMADD_SIZE_8BIT, &val, 1, 100);
//}

// Init base: reset, BDU+IF_INC, abilita XL/GYRO a 104Hz
static HAL_StatusTypeDef ism330_init(void) {
  HAL_StatusTypeDef st;
  uint8_t who=0, ctrl3=0;

  // Reset
  st = imu_write_u8(CTRL3_C, 0x01);
  if (st != HAL_OK) return st;

  // Attendi fine reset
  do {
    HAL_Delay(2);
    st = imu_read_u8(CTRL3_C, &ctrl3);
    if (st != HAL_OK) return st;
  } while (ctrl3 & 0x01);

  // IF_INC=1 (autoincrement), BDU=1
  st = imu_write_u8(CTRL3_C, 0x44);
  if (st != HAL_OK) return st;

  // Accel: 104 Hz, ±2g
  st = imu_write_u8(CTRL1_XL, 0x40);
  if (st != HAL_OK) return st;

  // Gyro: 104 Hz, 2000 dps
  st = imu_write_u8(CTRL2_G, 0x4C);
  if (st != HAL_OK) return st;

  // WHO_AM_I
  st = imu_read_u8(WHO_AM_I_REG, &who);
  if (st != HAL_OK) return st;
  printf("WHO_AM_I = 0x%02X (atteso 0x6B)\r\n", who);

  return (who == 0x6B) ? HAL_OK : HAL_ERROR;
}
static HAL_StatusTypeDef ism330_read_accel(float *ax_mg, float *ay_mg, float *az_mg) {
  uint8_t raw[6];
  HAL_StatusTypeDef st = HAL_I2C_Mem_Read(&hi2c1, imu_addr, OUTX_L_A, I2C_MEMADD_SIZE_8BIT, raw, 6, 100);
  if (st != HAL_OK) return st;

  int16_t x = (int16_t)((raw[1] << 8) | raw[0]);
  int16_t y = (int16_t)((raw[3] << 8) | raw[2]);
  int16_t z = (int16_t)((raw[5] << 8) | raw[4]);

  const float sens = 0.061f;  // mg/LSB @ ±2g
  *ax_mg = x * sens; *ay_mg = y * sens; *az_mg = z * sens;
  return HAL_OK;
}

static HAL_StatusTypeDef ism330_read_accel_ms2(float *ax, float *ay, float *az) {
  uint8_t raw[6];
  HAL_StatusTypeDef st = HAL_I2C_Mem_Read(&hi2c1, imu_addr, OUTX_L_A, I2C_MEMADD_SIZE_8BIT, raw, 6, 100);
  if (st != HAL_OK) return st;

  int16_t x = (int16_t)((raw[1] << 8) | raw[0]);
  int16_t y = (int16_t)((raw[3] << 8) | raw[2]);
  int16_t z = (int16_t)((raw[5] << 8) | raw[4]);

  const float SENS_MG_PER_LSB = 0.061f;
  const float MG_TO_MS2 = 9.80665e-3f;

  *ax = x * SENS_MG_PER_LSB * MG_TO_MS2;
  *ay = y * SENS_MG_PER_LSB * MG_TO_MS2;
  *az = z * SENS_MG_PER_LSB * MG_TO_MS2;
  return HAL_OK;
}


static HAL_StatusTypeDef lsm6dsox_read_accel_ms2(float *ax, float *ay, float *az)
{
    uint8_t raw[6];
    HAL_StatusTypeDef st = HAL_I2C_Mem_Read(&hi2c1, LSM6DSOX_ADDR,
                                            LSM6DSOX_OUTX_L_A, I2C_MEMADD_SIZE_8BIT,
                                            raw, 6, 100);
    if (st != HAL_OK) return st;

    int16_t x = (int16_t)((raw[1] << 8) | raw[0]);
    int16_t y = (int16_t)((raw[3] << 8) | raw[2]);
    int16_t z = (int16_t)((raw[5] << 8) | raw[4]);

    // Sensibilità a ±2g: 0.061 mg/LSB
    const float SENS_MG_PER_LSB = 0.061f;
    const float MG_TO_MS2 = 9.80665e-3f;

    *ax = x * SENS_MG_PER_LSB * MG_TO_MS2;
    *ay = y * SENS_MG_PER_LSB * MG_TO_MS2;
    *az = z * SENS_MG_PER_LSB * MG_TO_MS2;
    return HAL_OK;
}

// Legge accelerometro in mg (±2g, sens=0.061 mg/LSB a 16-bit)
static HAL_StatusTypeDef lsm6dsox_read_accel(float *ax_mg, float *ay_mg, float *az_mg) {
  uint8_t raw[6];
  HAL_StatusTypeDef st = HAL_I2C_Mem_Read(&hi2c1, LSM6DSOX_ADDR,
                                          LSM6DSOX_OUTX_L_A, I2C_MEMADD_SIZE_8BIT,
                                          raw, 6, 100);
  if (st != HAL_OK) return st;

  int16_t x = (int16_t)((raw[1] << 8) | raw[0]);
  int16_t y = (int16_t)((raw[3] << 8) | raw[2]);
  int16_t z = (int16_t)((raw[5] << 8) | raw[4]);

  const float sens = 0.061f;  // mg/LSB @±2g
  *ax_mg = x * sens;
  *ay_mg = y * sens;
  *az_mg = z * sens;
  return HAL_OK;
}

static void i2c_scan(void)
{
  printf("I2C scan...\r\n");
  for (uint8_t addr = 1; addr < 127; addr++) {
    if (HAL_I2C_IsDeviceReady(&hi2c1, addr << 1, 1, 5) == HAL_OK) {
      printf("Found 7-bit 0x%02X (8-bit 0x%02X)\r\n", addr, addr<<1);
    }
  }
}

//static void IMUTask(void *argument)
//{
//
//	if (imu_pick_addr()!=0) printf("IMU non trovata\r\n");
//
//	printf("Init ISM330...\r\n");
//	if (ism330_init() != HAL_OK) {
//	  printf("ISM330 init ERROR\r\n");
//	   Error_Handler() ;
//	}
//
////  // Inizializza IMU una sola volta
////  printf("Init LSM6DSOX...\r\n");
////  if (lsm6dsox_init() != HAL_OK) {
////    printf("LSM6DSOX init ERROR\r\n");
////    Error_Handler();
////  }
//  printf("LSM6DSOX OK\r\n");
////
//  for (;;) {
//    float ax, ay, az;
//    if (ism330_read_accel_ms2(&ax, &ay, &az) == HAL_OK) {
//    	printf("AX=%.2f ms2  AY=%.2f ms2  AZ=%.2f ms2\r\n", ax, ay, az);
//      // Se non hai il printf float attivo, stampa in mg come interi:
////      int ax_i = (int)(ax + (ax>=0?0.5f:-0.5f));
////      int ay_i = (int)(ay + (ay>=0?0.5f:-0.5f));
////      int az_i = (int)(az + (az>=0?0.5f:-0.5f));
////      printf("AX=%d mg  AY=%d mg  AZ=%d mg\r\n", ax_i, ay_i, az_i);
//      // Se hai abilitato il float: printf("AX=%.2f mg AY=%.2f mg AZ=%.2f mg\r\n", ax, ay, az);
//    } else {
//      printf("Read accel ERROR\r\n");
//    }
//    osDelay(100); // 10 Hz
//  }
//}

static int to_fixed3(char *dst, size_t dstsz, float v) {
    int32_t m = (int32_t)(v * 1000.0f + (v >= 0 ? 0.5f : -0.5f));
    if (m < 0) { int n = snprintf(dst, dstsz, "-%ld.%03ld", (long)(-m/1000), (long)((-m)%1000)); return n; }
    return snprintf(dst, dstsz, "%ld.%03ld", (long)(m/1000), (long)(m%1000));
}

static void IMUTask(void *argument)
{
	if (imu_pick_addr()!=0) {
	        printf("IMU non trovata\r\n");
	    }

	    printf("Init ISM330...\r\n");
	    if (ism330_init() != HAL_OK) {
	        printf("ISM330 init ERROR\r\n");
	        Error_Handler();
	    }
	    printf("ISM330 OK\r\n");

	    // --- SD / FS ---
	    FATFS fs;
	    FIL f;
	    FRESULT fr;

	    fr = f_mount(&fs, USERPath, 1);
	    printf("f_mount -> %d\r\n", fr);
	    if (fr != FR_OK) {
	        printf("Mount fail, esco dal task\r\n");
	        vTaskDelete(NULL);
	    }

	    fr = f_open(&f, "0:/accel.txt", FA_WRITE | FA_CREATE_ALWAYS);
	    printf("f_open -> %d\r\n", fr);
	    if (fr != FR_OK) {
	        f_mount(NULL, USERPath, 1);
	        vTaskDelete(NULL);
	    }

	    if (f_size(&f) == 0) {
	        f_printf(&f, "time_ms,ax,ay,az\r\n");
	        f_sync(&f);
	    }

	    printf("Logging... premi USER per fermare.\r\n");

	    // per ridurre i flush
	    int flush_cnt = 0;

	    // (opzionale) LED verde acceso durante logging
	    BSP_LED_On(LED_GREEN);

	    for (;;)
	    {
	        // === Check pulsante per STOP ===
	        if (BspButtonState == BUTTON_PRESSED) {

				osDelay(30); // debounce
				// aspetta rilascio: torna HIGH
				while (BSP_PB_GetState(BUTTON_USER) == GPIO_PIN_RESET) {
					osDelay(5);
				}
				BspButtonState = BUTTON_RELEASED;

				printf("Stop richiesto: sync/close/unmount...\r\n");
				f_sync(&f);
				f_close(&f);
				f_mount(NULL, USERPath, 1);
				BSP_LED_Off(LED_GREEN);
				printf("Registrazione fermata e file chiuso.\r\n");
				vTaskDelete(NULL);

	        }


	        // === Lettura IMU ===
	        float ax, ay, az;
	        if (ism330_read_accel_ms2(&ax, &ay, &az) == HAL_OK) {

	            // converti a interi in milli-(m/s^2) con arrotondamento
	            int32_t ax_mms2 = (int32_t)(ax * 1000.0f + (ax >= 0 ? 0.5f : -0.5f));
	            int32_t ay_mms2 = (int32_t)(ay * 1000.0f + (ay >= 0 ? 0.5f : -0.5f));
	            int32_t az_mms2 = (int32_t)(az * 1000.0f + (az >= 0 ? 0.5f : -0.5f));

	            // scrivi una riga CSV senza usare %f
	            f_printf(&f, "%lu,%ld,%ld,%ld\r\n",
	                     (unsigned long)HAL_GetTick(),
	                     (long)ax_mms2, (long)ay_mms2, (long)az_mms2);

	            if (++flush_cnt >= 10) {
	                FRESULT frs = f_sync(&f);
	                if (frs != FR_OK) {
	                    printf("f_sync err=%d\r\n", frs);
	                }
	                flush_cnt = 0;
	            }
	        } else {
	            printf("Read accel ERROR\r\n");
	        }


	        osDelay(100); // 10 Hz
	    }

	    // In pratica non si arriva qui, ma ok:
	    f_close(&f);
	    f_mount(NULL, USERPath, 1);
	    BSP_LED_Off(LED_GREEN);
}


static const char *fr_str(FRESULT fr){
  switch(fr){
    case FR_OK: return "FR_OK";
    case FR_DISK_ERR: return "FR_DISK_ERR";
    case FR_INT_ERR: return "FR_INT_ERR";
    case FR_NOT_READY: return "FR_NOT_READY";
    case FR_NO_FILE: return "FR_NO_FILE";
    case FR_NO_PATH: return "FR_NO_PATH";
    case FR_INVALID_NAME: return "FR_INVALID_NAME";
    case FR_DENIED: return "FR_DENIED";
    case FR_EXIST: return "FR_EXIST";
    case FR_INVALID_OBJECT: return "FR_INVALID_OBJECT";
    case FR_WRITE_PROTECTED: return "FR_WRITE_PROTECTED";
    case FR_INVALID_DRIVE: return "FR_INVALID_DRIVE";
    case FR_NOT_ENABLED: return "FR_NOT_ENABLED";
    case FR_NO_FILESYSTEM: return "FR_NO_FILESYSTEM";
    case FR_MKFS_ABORTED: return "FR_MKFS_ABORTED";
    case FR_TIMEOUT: return "FR_TIMEOUT";
    default: return "FR_xxx";
  }
}


/* USER CODE END 0 */

/**
  * @brief  The application entry point.
  * @retval int
  */
int main(void)
{

  /* USER CODE BEGIN 1 */

  /* USER CODE END 1 */
/* USER CODE BEGIN Boot_Mode_Sequence_0 */
/* USER CODE END Boot_Mode_Sequence_0 */

/* USER CODE BEGIN Boot_Mode_Sequence_1 */
  /* Wait until CPU2 boots and enters in stop mode or timeout*/
//  timeout = 0xFFFF;
//  while((__HAL_RCC_GET_FLAG(RCC_FLAG_D2CKRDY) != RESET) && (timeout-- > 0));
//  if ( timeout < 0 )
//  {
//  Error_Handler();
//  }
/* USER CODE END Boot_Mode_Sequence_1 */
  /* MCU Configuration--------------------------------------------------------*/

  /* Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();

  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* Configure the system clock */
  SystemClock_Config();
/* USER CODE BEGIN Boot_Mode_Sequence_2 */
  /* When system initialization is finished, Cortex-M7 will release Cortex-M4 by means of
  HSEM notification */
  /*HW semaphore Clock enable*/
//  __HAL_RCC_HSEM_CLK_ENABLE();
  /*Take HSEM */
  HAL_HSEM_FastTake(HSEM_ID_0);
  /*Release HSEM in order to notify the CPU2(CM4)*/
  HAL_HSEM_Release(HSEM_ID_0, 0);
  /* wait until CPU2 wakes up from stop mode */
//  timeout = 0xFFFF;
//  while ((__HAL_RCC_GET_FLAG(RCC_FLAG_D2CKRDY) == RESET) && (timeout-- > 0));
//  if (timeout < 0)
//  {
//    Error_Handler();
//  }
/* USER CODE END Boot_Mode_Sequence_2 */

  /* USER CODE BEGIN SysInit */

  /* USER CODE END SysInit */

  /* Initialize all configured peripherals */
  MX_GPIO_Init();
  MX_DMA_Init();
  MX_USART3_UART_Init();
  MX_I2C1_Init();
  MX_SPI1_Init();


  printf("start FATFS_Init ....\r\n");
  MX_FATFS_Init();

  FATFS fs;
  FRESULT fr;

  /* 1) Monta */
//  printf("Mount %s ...\r\n", USERPath);   // di solito "0:"
//  fr = f_mount(&fs, USERPath, 1);
//  printf("f_mount -> %d (%s)\r\n", fr, fr_str(fr));
//
//  /* 2) Se non c'è filesystem, crea FAT e rimonta */
//  if (fr == FR_NO_FILESYSTEM) {
//    printf("No filesystem, format FAT...\r\n");
//    BYTE work[4096];
//    fr = f_mkfs(USERPath, FM_FAT | FM_SFD, 0, work, sizeof(work));
//    printf("f_mkfs -> %d (%s)\r\n", fr, fr_str(fr));
//    if (fr == FR_OK) {
//      f_mount(NULL, USERPath, 0);
//      fr = f_mount(&fs, USERPath, 1);
//      printf("re-mount -> %d (%s)\r\n", fr, fr_str(fr));
//    }
//  }
//
//  /* 3) Se montato, crea/scrive file */
//  if (fr == FR_OK) {
//    FIL f;
//    const char *fname = "0:/test.txt";        // percorsi assoluti: usa 0:/ ...
//    fr = f_open(&f, fname, FA_WRITE | FA_CREATE_ALWAYS);
//    printf("f_open(%s) -> %d (%s)\r\n", fname, fr, fr_str(fr));
//
//    if (fr == FR_OK) {
//      UINT bw;
//      char line[64];
//      int nl = snprintf(line, sizeof(line), "simone testa di culo\r\n");
//      fr = f_write(&f, line, (UINT)nl, &bw);
//      // scrivi qualche numero
//      for (int i=0; i<10; i++) {
//        int n = snprintf(line, sizeof(line), "i=%d, tick=%lu\r\n", i, HAL_GetTick());
//        fr = f_write(&f, line, (UINT)n, &bw);
//        if (fr != FR_OK || bw != (UINT)n) {
//          printf("f_write err: fr=%d (%s), bw=%u\r\n", fr, fr_str(fr), (unsigned)bw);
//          break;
//        }
//      }
//
//      f_sync(&f);      // assicura flush su SD
//      f_close(&f);
//      printf("write OK\r\n");
//    }
//
//    /* 4) Lista la root per verificare che il file esista */
//    DIR dir;
//    FILINFO fi;
//  #if _USE_LFN
//    char lfn[128];
//    fi.lfname = lfn;
//    fi.lfsize = sizeof(lfn);
//  #endif
//    fr = f_opendir(&dir, "0:/");
//    if (fr == FR_OK) {
//      printf("Root listing:\r\n");
//      for (;;) {
//        fr = f_readdir(&dir, &fi);
//        if (fr != FR_OK || fi.fname[0] == 0) break;
//  #if _USE_LFN
//        const char *name = (*fi.lfname) ? fi.lfname : fi.fname;
//  #else
//        const char *name = fi.fname;
//  #endif
//        printf("  %s%s  (%lu bytes)\r\n",
//               name,
//               (fi.fattrib & AM_DIR) ? "/" : "",
//               (unsigned long)fi.fsize);
//      }
//      f_closedir(&dir);
//    } else {
//      printf("f_opendir err: %d (%s)\r\n", fr, fr_str(fr));
//    }
//
//    f_mount(NULL, USERPath, 1);   // smonta
//  } else {
//    printf("Mount FAIL -> %d (%s)\r\n", fr, fr_str(fr));
//  }
  /* USER CODE END 2 */

  /* Init scheduler */
  osKernelInitialize();  /* Call init function for freertos objects (in cmsis_os2.c) */
//  MX_FREERTOS_Init();

  /* Initialize leds */
  BSP_LED_Init(LED_GREEN);
  BSP_LED_Init(LED_YELLOW);
  BSP_LED_Init(LED_RED);

  /* Initialize USER push-button, will be used to trigger an interrupt each time it's pressed.*/
  BSP_PB_Init(BUTTON_USER, BUTTON_MODE_EXTI);

  /* USER CODE BEGIN BSP */
  /* -- Sample board code to switch on leds ---- */
  BSP_LED_On(LED_GREEN);
  BSP_LED_On(LED_YELLOW);
  BSP_LED_On(LED_RED);
  /* USER CODE END BSP */

  const osThreadAttr_t IMUTask_attributes = {
    .name = "IMUTask",
    .stack_size = 512 * 4,
    .priority = (osPriority_t) osPriorityNormal,
  };
  osThreadNew(IMUTask, NULL, &IMUTask_attributes);

  /* Start scheduler */
  osKernelStart();

  /* We should never get here as control is now taken by the scheduler */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
  while (1)
  {
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */
  }

  /* USER CODE END 3 */
}

/**
  * @brief System Clock Configuration
  * @retval None
  */
void SystemClock_Config(void)
{
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

  /** Supply configuration update enable
  */
  HAL_PWREx_ConfigSupply(PWR_DIRECT_SMPS_SUPPLY);

  /** Configure the main internal regulator output voltage
  */
  __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE3);

  while(!__HAL_PWR_GET_FLAG(PWR_FLAG_VOSRDY)) {}

  /** Initializes the RCC Oscillators according to the specified parameters
  * in the RCC_OscInitTypeDef structure.
  */
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSI;
  RCC_OscInitStruct.HSIState = RCC_HSI_DIV1;
  RCC_OscInitStruct.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSI;
  RCC_OscInitStruct.PLL.PLLM = 4;
  RCC_OscInitStruct.PLL.PLLN = 12;
  RCC_OscInitStruct.PLL.PLLP = 2;
  RCC_OscInitStruct.PLL.PLLQ = 2;
  RCC_OscInitStruct.PLL.PLLR = 2;
  RCC_OscInitStruct.PLL.PLLRGE = RCC_PLL1VCIRANGE_3;
  RCC_OscInitStruct.PLL.PLLVCOSEL = RCC_PLL1VCOWIDE;
  RCC_OscInitStruct.PLL.PLLFRACN = 4096;
  if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
  {
    Error_Handler();
  }

  /** Initializes the CPU, AHB and APB buses clocks
  */
  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK
                              |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2
                              |RCC_CLOCKTYPE_D3PCLK1|RCC_CLOCKTYPE_D1PCLK1;
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_HSI;
  RCC_ClkInitStruct.SYSCLKDivider = RCC_SYSCLK_DIV1;
  RCC_ClkInitStruct.AHBCLKDivider = RCC_HCLK_DIV1;
  RCC_ClkInitStruct.APB3CLKDivider = RCC_APB3_DIV1;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_APB1_DIV2;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_APB2_DIV1;
  RCC_ClkInitStruct.APB4CLKDivider = RCC_APB4_DIV1;

  if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_1) != HAL_OK)
  {
    Error_Handler();
  }
}

/* USER CODE BEGIN 4 */

/**
  * @brief  Send Txt information message on UART Tx line (to PC Com port).
  * @param  huart UART handle.
  * @param  String String to be sent to user display
  * @param  Size   Size of string
  * @retval None
  */
void PrintInfo(UART_HandleTypeDef *huart, uint8_t *String, uint16_t Size)
{
  if (HAL_OK != HAL_UART_Transmit(huart, String, Size, 100))
  {
    Error_Handler();
  }
}

/**
  * @brief  This function prints user info on PC com port and initiates RX transfer
  * @retval None
  */
void StartReception(UART_HandleTypeDef *huart)
{
  /* Initializes Buffer swap mechanism (used in User callback) :
  - 2 physical buffers aRXBufferA and aRXBufferB (RX_BUFFER_SIZE length)
   */
  pBufferReadyForReception = aRXBufferA;
  pBufferReadyForUser      = aRXBufferB;
  uwNbReceivedChars        = 0;

  /* Print user info on PC com port */
  PrintInfo(&huart3, aTextInfoStart, COUNTOF(aTextInfoStart));

  /* Initializes Rx sequence using Reception To Idle event API.
  As DMA channel associated to UART Rx is configured as Circular,
  reception is endless.
  If reception has to be stopped, call to HAL_UART_AbortReceive() could be used.

  Use of HAL_UARTEx_ReceiveToIdle_DMA service, will generate calls to
  user defined HAL_UARTEx_RxEventCallback callback for each occurrence of
  following events :
  - DMA RX Half Transfer event (HT)
  - DMA RX Transfer Complete event (TC)
  - IDLE event on UART Rx line (indicating a pause is UART reception flow)
  */
  if (HAL_OK != HAL_UARTEx_ReceiveToIdle_DMA(huart, aRXBufferUser, UART_DMA_RX_BUFFER_SIZE))
  {
    Error_Handler();
  }
}

/**
  * @brief  This function handles buffer containing received data on PC com port
  * @note   In this example, received data are sent back on UART Tx (loopback)
  *         Any other processing such as copying received data in a larger buffer to make it
  *         available for application, could be implemented here.
  * @note   This routine is executed in Interrupt context.
  * @param  huart UART handle.
  * @param  pData Pointer on received data buffer to be processed
  * @retval Size  Nb of received characters available in buffer
  */
void UserDataTreatment(UART_HandleTypeDef *huart, uint8_t* pData, uint16_t Size)
{
  /*
   * This function might be called in any of the following interrupt contexts :
   *  - DMA TC and HT events
   *  - UART IDLE line event
   *
   * pData and Size defines the buffer where received data have been copied, in order to be processed.
   * During this processing of already received data, reception is still ongoing.
   *
   */
  uint8_t* pBuff = pData;

  /* Implementation of loopback is on purpose implemented in direct register access,
    in order to be able to echo received characters as fast as they are received.
    Wait for TC flag to be raised at end of transmit is then removed, only TXE is checked */
  for (uint8_t i = 0; i < Size; i++)
  {
    while (!(__HAL_UART_GET_FLAG(huart, UART_FLAG_TXE))) {}
    huart->Instance->TDR = *pBuff;
    pBuff++;
  }

}

void UartRxCheck(UART_HandleTypeDef *huart, uint16_t Size)
{
  static uint8_t old_pos = 0;
  uint8_t *ptemp;
  uint8_t i;

  /* Check if number of received data in recpetion buffer has changed */
  if (Size != old_pos)
  {
    /* Check if position of index in reception buffer has simply be increased
     of if end of buffer has been reached */
    if (Size > old_pos)
    {
      /* Current position is higher than previous one */
      uwNbReceivedChars = Size - old_pos;
      /* Copy received data in "User" buffer for evacuation */
      for (i = 0; i < uwNbReceivedChars; i++)
      {
        pBufferReadyForUser[i] = aRXBufferUser[old_pos + i];
      }
    }
    else
    {
      /* Current position is lower than previous one : end of buffer has been reached */
      /* First copy data from current position till end of buffer */
      uwNbReceivedChars = UART_DMA_RX_BUFFER_SIZE - old_pos;
      /* Copy received data in "User" buffer for evacuation */
      for (i = 0; i < uwNbReceivedChars; i++)
      {
        pBufferReadyForUser[i] = aRXBufferUser[old_pos + i];
      }
      /* Check and continue with beginning of buffer */
      if (Size > 0)
      {
        for (i = 0; i < Size; i++)
        {
          pBufferReadyForUser[uwNbReceivedChars + i] = aRXBufferUser[i];
        }
        uwNbReceivedChars += Size;
      }
    }
    /* Process received data/opt/st/stm32cubeide_1.19.0/plugins/com.st.stm32cube.ide.mcu.externaltools.gnu-tools-for-stm32.13.3.rel1.linux64_1.0.0.202410170706/tools/bin/../lib/gcc/arm-none-eabi/13.3.1/../../../../arm-none-eabi/bin/ld: ./Core/Src/usart.o:/home/dario/Workspace/NUCLEO-H755ZI-UART-ReceptionToIdle/CM7/Debug/../Core/Src/usart.c:27: multiple definition of `huart3'; ./Core/Src/main.o:/home/dario/Workspace/NUCLEO-H755ZI-UART-ReceptionToIdle/CM7/Debug/../Core/Src/main.c:66: first defined here
     *  that has been extracted from Rx User buffer */
    UserDataTreatment(huart, pBufferReadyForUser, uwNbReceivedChars);

    /* Swap buffers for next bytes to be processed */
    ptemp = pBufferReadyForUser;
    pBufferReadyForUser = pBufferReadyForReception;
    pBufferReadyForReception = ptemp;
  }
  /* Update old_pos as new reference of position in User Rx buffer that
  indicates position to which data have been processed */
  old_pos = Size;
}

/**
  * @brief  User implementation of the Reception Event Callback
  *         (Rx event notification called after use of advanced reception service).
  * @param  huart UART handle
  * @param  Size  Number of data available in application reception buffer (indicates a position in
  *               reception buffer until which, data are available)
  * @retval None
  */
void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef *huart, uint16_t Size)
{
  if (huart->Instance == USART3)
  {
    // Send message to queue from ISR
//    osMessageQueuePut(UartMessageHandle, &Size, 0, 0);
  }
}

/**
  * @brief  Retargets the C library printf function to the USART.
  *   None
  * @retval None
  */
PUTCHAR_PROTOTYPE
{
  /* Place your implementation of fputc here */
  /* e.g. write a character to the USART1 and Loop until the end of transmission */
  HAL_UART_Transmit(&huart3, (uint8_t *)&ch, 1, HAL_MAX_DELAY);

  return ch;
}

/* USER CODE END 4 */

/**
  * @brief  Period elapsed callback in non blocking mode
  * @note   This function is called  when TIM6 interrupt took place, inside
  * HAL_TIM_IRQHandler(). It makes a direct call to HAL_IncTick() to increment
  * a global variable "uwTick" used as application time base.
  * @param  htim : TIM handle
  * @retval None
  */
void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim)
{
  /* USER CODE BEGIN Callback 0 */

  /* USER CODE END Callback 0 */
  if (htim->Instance == TIM6)
  {
    HAL_IncTick();
  }
  /* USER CODE BEGIN Callback 1 */

  /* USER CODE END Callback 1 */
}

/**
  * @brief  BSP Push Button callback
  * @param  Button Specifies the pressed button
  * @retval None
  */
/**
  * @brief  This function is executed in case of error occurrence.
  * @retval None
  */
void Error_Handler(void)
{
  /* USER CODE BEGIN Error_Handler_Debug */
  /* User can add his own implementation to report the HAL error return state */
  while (1)
  {
    /* Toggle LED2 for error */
    BSP_LED_Toggle(LED_RED);
//    HAL_Delay(50);
  }
  /* USER CODE END Error_Handler_Debug */
}
#ifdef USE_FULL_ASSERT
/**
  * @brief  Reports the name of the source file and the source line number
  *         where the assert_param error has occurred.
  * @param  file: pointer to the source file name
  * @param  line: assert_param error line source number
  * @retval None
  */
void assert_failed(uint8_t *file, uint32_t line)
{
  /* USER CODE BEGIN 6 */
  /* User can add his own implementation to report the file name and line number,
     ex: printf("Wrong parameters value: file %s on line %d\r\n", file, line) */
  /* USER CODE END 6 */
}
#endif /* USE_FULL_ASSERT */
