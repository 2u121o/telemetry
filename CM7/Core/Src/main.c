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

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include <stdio.h>
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */

static volatile uint32_t dbg_rx_events = 0;
static volatile uint16_t dbg_last_size = 0;
static uint8_t          dbg_last_bytes[64];

static FATFS fs_gnss;
static FIL   f_gnss;
static int   gnss_log_open = 0;
static int   gnss_flush_cnt = 0;

static struct {
  char   utc_hms[16];
  char   date[8];         // ddmmyy
  double lat, lon;
  int    have_ll;         // 1 se lat/lon validi
  int    fix, sats;
  double hdop, alt_m;
  double speed_kn, course_deg;
  int    have_gga;
  int    have_rmc;
} g = {0};

//static gnss_state_t g = {0};

static void gnss_log_write_line(const char *line)
{
  if (!gnss_log_open) return;

  /* scrivo la riga così com’è; se non finisce con CR/LF la aggiungo */
  UINT bw = 0;
  f_printf(&f_gnss, "%s\r\n", line);
  gnss_flush_cnt++;
  if (gnss_flush_cnt >= 10) {
    f_sync(&f_gnss);
    gnss_flush_cnt = 0;
  }
}

typedef struct tagButtonMessage
{
  Button_TypeDef buttonType;
  uint16_t buttonState;
} ButtonMessage_t;

extern UART_HandleTypeDef huart3;
extern char USERPath[4];

#define GNSS_RX_BUF_SIZE 256
static uint8_t gnss_rx_buf[GNSS_RX_BUF_SIZE];   // buffer DMA
static uint8_t gnss_line[GNSS_RX_BUF_SIZE];
static volatile uint32_t gnss_rx_bytes = 0;
static volatile uint32_t gnss_last_rx_ms = 0;

static void GNSS_StartReception(void);

#define NMEA_DMA_BUF_SZ   256
#define NMEA_RING_SZ      1024

static uint8_t  nmea_dma_buf[NMEA_DMA_BUF_SZ];
static uint8_t  nmea_ring[NMEA_RING_SZ];
static volatile uint16_t rb_head = 0, rb_tail = 0;

static void set_usart2_baud(uint32_t baud){
  huart2.Init.BaudRate = baud;
  HAL_UART_DeInit(&huart2);
  if (HAL_UART_Init(&huart2) != HAL_OK) { Error_Handler(); }
}

// push bytes in ring
static void rb_push(const uint8_t *data, uint16_t len){
  for(uint16_t i=0;i<len;i++){
    uint16_t next = (rb_head + 1) % NMEA_RING_SZ;
    if (next == rb_tail) { /* overflow -> drop oldest */ rb_tail = (rb_tail + 1) % NMEA_RING_SZ; }
    nmea_ring[rb_head] = data[i];
    rb_head = next;
  }
}
static int rb_pop_byte(uint8_t *b){
  if (rb_head == rb_tail) return 0;
  *b = nmea_ring[rb_tail];
  rb_tail = (rb_tail + 1) % NMEA_RING_SZ;
  return 1;
}

// checksum NMEA: XOR tra caratteri tra '$' e '*'
static int nmea_check_cs(const char *s){
  if (s[0] != '$') return 0;
  const char *star = NULL;
  uint8_t cs = 0;
  for (const char *p = s+1; *p; ++p){
    if (*p == '*'){ star = p; break; }
    cs ^= (uint8_t)(*p);
  }
  if (!star || !star[1] || !star[2]) return 0;
  uint8_t want = (uint8_t)strtoul(star+1, NULL, 16);
  return cs == want;
}

// ddmm.mmmm (+ N/S, E/W) -> gradi decimali
static int nmea_parse_latlon(const char *ddmm, const char hemi, double *deg_out, int is_lat){
  if (!ddmm || !*ddmm) return 0;
  // lat: 2 cifre di gradi; lon: 3 cifre di gradi
  int gdigits = is_lat ? 2 : 3;
  char gbuf[4] = {0};
  for(int i=0;i<gdigits;i++){ if (ddmm[i]<'0'||ddmm[i]>'9') return 0; gbuf[i]=ddmm[i]; }
  int deg = atoi(gbuf);
  double min = atof(ddmm + gdigits);
  double dec = deg + (min/60.0);
  if (hemi=='S' || hemi=='W') dec = -dec;
  *deg_out = dec;
  return 1;
}

static void to_fixedN(char *dst, size_t n, double v, int dec){
  long mul = 1;
  for(int i=0;i<dec;i++) mul *= 10;
  long sgn = (v < 0) ? -1 : 1;
  long a = (long) llround(fabs(v) * mul);
  long intp = a / mul;
  long frac = a % mul;
  if (dec == 0) {
    snprintf(dst, n, "%s%ld", (sgn<0?"-":""), intp);
  } else {
    // padding zeri sulla parte frazionaria
    char fracbuf[16];
    snprintf(fracbuf, sizeof(fracbuf), "%0*ld", dec, frac);
    snprintf(dst, n, "%s%ld.%s", (sgn<0?"-":""), intp, fracbuf);
  }
}

static void nmea_poll_and_print(void)
{

	 static char line[128];
	  static uint16_t L = 0;
	  uint8_t b;

	  while (rb_pop_byte(&b)) {
	    if (b == '\r') continue;
	    if (b == '\n') {

	      line[L] = 0;
	      if (L >= 9 && line[0]=='$' && nmea_check_cs(line)) {
//	    	  gnss_log_write_line(line);
	    	  if (strstr(line, "GGA,")) {
	    	    char *p = line;

	    	    // hhmmss
	    	    p = strchr(p, ','); if(!p) goto next; p++;
	    	    // salva l’ora
	    	    char *comma = strchr(p, ','); if(!comma) goto next;
	    	    *comma = 0;
	    	    strncpy(g.utc_hms, p, sizeof(g.utc_hms)-1);
	    	    g.utc_hms[sizeof(g.utc_hms)-1]=0;
	    	    p = comma+1;

	    	    // lat, N/S
	    	    char *lat = p;
	    	    p = strchr(p, ','); if(!p) goto next; *p = 0; p++;
	    	    char hemiNS = *p;
	    	    p = strchr(p, ','); if(!p) goto next; p++;  // vai oltre N/S

	    	    // lon, E/W
	    	    char *lon = p;
	    	    p = strchr(p, ','); if(!p) goto next; *p = 0; p++;
	    	    char hemiEW = *p;
	    	    p = strchr(p, ','); if(!p) goto next; p++;  // vai oltre E/W

	    	    // fix
	    	    g.fix = atoi(p);
	    	    p = strchr(p, ','); if(!p) goto next; p++;

	    	    // sats
	    	    g.sats = atoi(p);
	    	    p = strchr(p, ','); if(!p) goto next; p++;

	    	    // hdop
	    	    g.hdop = atof(p);
	    	    p = strchr(p, ','); if(!p) goto next; p++;

	    	    // alt (m)
	    	    g.alt_m = atof(p);

	    	    // converti lat/lon
	    	    double dlat=0, dlon=0;
	    	    if (nmea_parse_latlon(lat, hemiNS, &dlat, 1) &&
	    	        nmea_parse_latlon(lon, hemiEW, &dlon, 0)) {
	    	      g.lat = dlat; g.lon = dlon; g.have_ll = 1;
	    	    }
	    	    g.have_gga = 1;
	    	  }

	    	  // --- RMC ---
	    	  else if (strstr(line, "RMC,")) {
	    	    char *p = line;

	    	    // hhmmss
	    	    p = strchr(p, ','); if(!p) goto next; p++;
	    	    char *comma = strchr(p, ','); if(!comma) goto next;
	    	    *comma = 0;
	    	    strncpy(g.utc_hms, p, sizeof(g.utc_hms)-1);
	    	    g.utc_hms[sizeof(g.utc_hms)-1]=0;
	    	    p = comma+1;

	    	    // status
	    	    char status = *p;
	    	    p = strchr(p, ','); if(!p) goto next; p++;

	    	    // lat, N/S
	    	    char *lat = p;
	    	    p = strchr(p, ','); if(!p) goto next; *p = 0; p++;
	    	    char hemiNS = *p;
	    	    p = strchr(p, ','); if(!p) goto next; p++;

	    	    // lon, E/W
	    	    char *lon = p;
	    	    p = strchr(p, ','); if(!p) goto next; *p = 0; p++;
	    	    char hemiEW = *p;
	    	    p = strchr(p, ','); if(!p) goto next; p++;

	    	    // speed (kn)
	    	    g.speed_kn = atof(p);
	    	    p = strchr(p, ','); if(!p) goto next; p++;

	    	    // course (deg)
	    	    g.course_deg = atof(p);
	    	    p = strchr(p, ','); if(!p) goto next; p++;      // *** AVANZA OLTRE LA COURSE ***

	    	    // date ddmmyy
	    	    char *date_start = p;
	    	    comma = strchr(p, ',');
	    	    if (comma) *comma = 0;
	    	    strncpy(g.date, date_start, sizeof(g.date)-1);
	    	    g.date[sizeof(g.date)-1] = 0;

	    	    // aggiorna lat/lon da RMC (opzionale)
	    	    double dlat=0, dlon=0;
	    	    if (nmea_parse_latlon(lat, hemiNS, &dlat, 1) &&
	    	        nmea_parse_latlon(lon, hemiEW, &dlon, 0)) {
	    	      g.lat = dlat; g.lon = dlon; g.have_ll = 1;
	    	    }

	    	    g.have_rmc = (status=='A');
	    	  }

	    	  // --- SCRITTURA CSV: SOLO quando hai GGA+RMC+LL+DATE ---
	    	  if (gnss_log_open && g.have_gga && g.have_rmc && g.have_ll && g.date[0]) {
	    	    char slat[24], slon[24], shdop[16], salt[16], sspeed[16], scourse[16];
	    	    to_fixedN(slat,   sizeof(slat),   g.lat,        6);
	    	    to_fixedN(slon,   sizeof(slon),   g.lon,        6);
	    	    to_fixedN(shdop,  sizeof(shdop),  g.hdop,       2);
	    	    to_fixedN(salt,   sizeof(salt),   g.alt_m,      2);
	    	    to_fixedN(sspeed, sizeof(sspeed), g.speed_kn,   2);
	    	    to_fixedN(scourse,sizeof(scourse),g.course_deg, 2);

	    	    f_printf(&f_gnss, "%s,%s,%s,%s,%d,%d,%s,%s,%s,%s\r\n",
	    	             g.utc_hms, g.date, slat, slon, g.fix, g.sats,
	    	             shdop, salt, sspeed, scourse);

	    	    if (++gnss_flush_cnt >= 10) { f_sync(&f_gnss); gnss_flush_cnt = 0; }

	    	    // opzionale: azzera i “segnali” per evitare doppie righe sullo stesso ciclo
	    	    g.have_gga = g.have_rmc = 0;
	    	  }

	      }


	    next:
	      L = 0;
	    } else {
	      if (L < sizeof(line)-1) line[L++] = (char)b;
	      else L = 0; // overflow -> reset riga
	    }
	  }

}


/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */

uint8_t rx_char;

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
//  if (huart->Instance == USART2) {
//    // stampa il carattere su seriale debug (o bufferizzalo)
//    HAL_UART_Transmit(&huart2, &rx_char, 1, 10);
//    // riavvia ricezione
////    HAL_UART_Receive_IT(&huart2, &rx_char, 1);
//  }
}



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

//#define LSM6DSOX_ADDR       (0x6B << 1)     // 8-bit per HAL
//#define LSM6DSOX_WHOAMI     0x0F
//#define LSM6DSOX_CTRL1_XL   0x10
//#define LSM6DSOX_CTRL2_G    0x11
//#define LSM6DSOX_CTRL3_C    0x12
//#define LSM6DSOX_OUTX_L_A   0x28   // accel data start (auto-increment ON)

//void BSP_PB_Callback(Button_TypeDef Button)
//{
//
//  if (Button == BUTTON_USER)
//  {
//    BspButtonState = BUTTON_PRESSED;
//  }
//}

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

//static int pick_addr(void){
//  if (HAL_I2C_IsDeviceReady(&hi2c1, (0x6A<<1), 2, 50) == HAL_OK) { lsm_addr=(0x6A<<1); return 0; }
//  if (HAL_I2C_IsDeviceReady(&hi2c1, (0x6B<<1), 2, 50) == HAL_OK) { lsm_addr=(0x6B<<1); return 0; }
//  return -1;
//}
//#define LSM6DSOX_ADDR lsm_addr

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


//static HAL_StatusTypeDef lsm6dsox_read_accel_ms2(float *ax, float *ay, float *az)
//{
//    uint8_t raw[6];
//    HAL_StatusTypeDef st = HAL_I2C_Mem_Read(&hi2c1, LSM6DSOX_ADDR,
//                                            LSM6DSOX_OUTX_L_A, I2C_MEMADD_SIZE_8BIT,
//                                            raw, 6, 100);
//    if (st != HAL_OK) return st;
//
//    int16_t x = (int16_t)((raw[1] << 8) | raw[0]);
//    int16_t y = (int16_t)((raw[3] << 8) | raw[2]);
//    int16_t z = (int16_t)((raw[5] << 8) | raw[4]);
//
//    // Sensibilità a ±2g: 0.061 mg/LSB
//    const float SENS_MG_PER_LSB = 0.061f;
//    const float MG_TO_MS2 = 9.80665e-3f;
//
//    *ax = x * SENS_MG_PER_LSB * MG_TO_MS2;
//    *ay = y * SENS_MG_PER_LSB * MG_TO_MS2;
//    *az = z * SENS_MG_PER_LSB * MG_TO_MS2;
//    return HAL_OK;
//}
//
//// Legge accelerometro in mg (±2g, sens=0.061 mg/LSB a 16-bit)
//static HAL_StatusTypeDef lsm6dsox_read_accel(float *ax_mg, float *ay_mg, float *az_mg) {
//  uint8_t raw[6];
//  HAL_StatusTypeDef st = HAL_I2C_Mem_Read(&hi2c1, LSM6DSOX_ADDR,
//                                          LSM6DSOX_OUTX_L_A, I2C_MEMADD_SIZE_8BIT,
//                                          raw, 6, 100);
//  if (st != HAL_OK) return st;
//
//  int16_t x = (int16_t)((raw[1] << 8) | raw[0]);
//  int16_t y = (int16_t)((raw[3] << 8) | raw[2]);
//  int16_t z = (int16_t)((raw[5] << 8) | raw[4]);
//
//  const float sens = 0.061f;  // mg/LSB @±2g
//  *ax_mg = x * sens;
//  *ay_mg = y * sens;
//  *az_mg = z * sens;
//  return HAL_OK;
//}

static void i2c_scan(void)
{
  printf("I2C scan...\r\n");
  for (uint8_t addr = 1; addr < 127; addr++) {
    if (HAL_I2C_IsDeviceReady(&hi2c1, addr << 1, 1, 5) == HAL_OK) {
      printf("Found 7-bit 0x%02X (8-bit 0x%02X)\r\n", addr, addr<<1);
    }
  }
}

static void GNSS_DMA_Start(void) {
  HAL_StatusTypeDef s = HAL_UARTEx_ReceiveToIdle_DMA(&huart2, nmea_dma_buf, NMEA_DMA_BUF_SZ);
  if (s != HAL_OK) {
    printf("USART2 DMA start FAIL: s=%d RxState=%d gState=%d err=0x%08lX hdmarx=%p\r\n",
           s, huart2.RxState, huart2.gState, HAL_UART_GetError(&huart2), (void*)huart2.hdmarx);
    return; // non chiamare Error_Handler qui
  }
  if (huart2.hdmarx) __HAL_DMA_DISABLE_IT(huart2.hdmarx, DMA_IT_HT);
}

static void hexdump(const uint8_t *p, uint16_t n) {
  for (uint16_t i=0;i<n;i++) {
    printf("%02X ", p[i]);
    if ((i & 0x0F) == 0x0F) printf("\r\n");
  }
  if ((n & 0x0F) != 0) printf("\r\n");
}

static void GNSSTask(void *argument)
{

	 FRESULT fr = f_mount(&fs_gnss, USERPath, 1);
	    printf("GNSS f_mount -> %d\r\n", fr);
	    if (fr != FR_OK) {
	        printf("GNSS: SD non pronta (err=%d). Stop task.\r\n", fr);
	        vTaskDelete(NULL);                       // <— evita ritorno
	    }

	    fr = f_open(&f_gnss, "0:/nmea.txt", FA_WRITE | FA_CREATE_ALWAYS);
	    printf("GNSS f_open -> %d\r\n", fr);
	    if (fr != FR_OK) {
	        printf("GNSS: open fallita (err=%d). Unmount e stop.\r\n", fr);
	        f_mount(NULL, USERPath, 1);
	        vTaskDelete(NULL);                       // <— evita ritorno
	    }

	    gnss_log_open = 1;
	    if (f_size(&f_gnss) == 0) {
	        f_printf(&f_gnss, "utc_hms,date,lat,lon,fix,sats,hdop,alt_m,speed_kn,course_deg\r\n");
	        f_sync(&f_gnss);
	    }
//	    HAL_Delay(100);
//	    printf("GNSS task started (USART2)\r\n");
//	    GNSS_DMA_Start();

//	    uint32_t t0 = HAL_GetTick();
	    uint32_t t0 = 0;
	    for (;;) {
	    	if (BspButtonState == BUTTON_PRESSED) {

	    		osDelay(30); // debounce
	    						// aspetta rilascio: torna HIGH
	    						while (BSP_PB_GetState(BUTTON_USER) == GPIO_PIN_RESET) {
	    							osDelay(5);
	    						}
	    						BspButtonState = BUTTON_RELEASED;

	    						printf("Stop richiesto: sync/close/unmount...\r\n");
	    						f_sync(&f_gnss);
	    						f_close(&f_gnss);
	    						f_mount(NULL, USERPath, 1);
	    						BSP_LED_Off(LED_GREEN);
	    						printf("Registrazione fermata e file chiuso.\r\n");
	    						vTaskDelete(NULL);

	    	}
	    	if (HAL_GetTick() - t0 >= 1000) {
					t0 += 1000;
					uint32_t age = HAL_GetTick() - gnss_last_rx_ms;
					uint32_t ev  = dbg_rx_events;
					uint16_t sz  = dbg_last_size;
	//	            printf("[GNSS] bytes=%lu last=%lums events=%lu lastSz=%u\r\n",
	//	                   gnss_rx_bytes, age, ev, sz);
					if (age > 3000) {
	//	                printf("[GNSS] nessun dato recente -> restart DMA\r\n");
						GNSS_DMA_Start();
					}
				}
	//	        printf("before nmea_poll_and_print\r\n");
				nmea_poll_and_print();
	//	        printf("after nmea_poll_and_print\r\n");
				osDelay(10);
			}

	    // (in pratica non ci arrivi mai; ma per sicurezza)
	    if (gnss_log_open) {
	        f_sync(&f_gnss);
	        f_close(&f_gnss);
	        f_mount(NULL, USERPath, 1);
	        gnss_log_open = 0;
	    }
	    vTaskDelete(NULL);
}



static void i2c_dbg(const char* tag, HAL_StatusTypeDef st){
  uint32_t e = HAL_I2C_GetError(&hi2c1);
  printf("%s: st=%d err=0x%08lX\r\n", tag, (int)st, (unsigned long)e);
}


static int to_fixed3(char *dst, size_t dstsz, float v) {
    int32_t m = (int32_t)(v * 1000.0f + (v >= 0 ? 0.5f : -0.5f));
    if (m < 0) { int n = snprintf(dst, dstsz, "-%ld.%03ld", (long)(-m/1000), (long)((-m)%1000)); return n; }
    return snprintf(dst, dstsz, "%ld.%03ld", (long)(m/1000), (long)(m%1000));
}




static void IMUTask(void *argument)
{
//	  HAL_StatusTypeDef st = imu_write_u8(CTRL3_C, 0x01);
//	  i2c_dbg("imu_reset", st);
//	 HAL_Delay(100);                  // IMU power-up settle
//	    i2c_scan();
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


  MX_USART2_UART_Init();

  printf("start FATFS_Init ....\r\n");
  MX_SPI1_Init();
  MX_FATFS_Init();
  MX_I2C1_Init();
  HAL_Delay(100);
  set_usart2_baud(38400);
//  HAL_Delay(100);
//  i2c_scan(); // deve stampare 0x6B
//
//  uint8_t who = 0;
//  HAL_StatusTypeDef st;
//
//  HAL_I2C_DeInit(&hi2c1);
//  hi2c1.Init.Timing = 100;
//  HAL_I2C_Init(&hi2c1);
//  HAL_I2CEx_ConfigAnalogFilter(&hi2c1, I2C_ANALOGFILTER_ENABLE);
//  HAL_I2CEx_ConfigDigitalFilter(&hi2c1, 0);
//  st = HAL_I2C_Mem_Read(&hi2c1, 0x6B<<1, 0x0F,
//                        I2C_MEMADD_SIZE_8BIT,  // <-- IMPORTANTISSIMO!
//                        &who, 1, 100);
//  printf("WHO @0x6B: st=%d err=0x%08lX who=0x%02X\r\n",
//         st, (unsigned long)HAL_I2C_GetError(&hi2c1), who);
//
//  st = HAL_I2C_Mem_Read(&hi2c1, 0x7E<<1, 0x0F,
//                        I2C_MEMADD_SIZE_8BIT,
//                        &who, 1, 100);
//  printf("WHO @0x6A: st=%d err=0x%08lX who=0x%02X\r\n",
//         st, (unsigned long)HAL_I2C_GetError(&hi2c1), who);

//  MX_I2C1_Init();
//  HAL_Delay(100);
//  i2c_scan();
////
//  uint8_t who=0;
//  HAL_StatusTypeDef st;
//  st = HAL_I2C_Mem_Read(&hi2c1, 0x6B<<1, WHO_AM_I_REG, I2C_MEMADD_SIZE_8BIT, &who, 1, 100);
//  i2c_dbg("WHO 0x6B", st);
//  printf("WHO=0x%02X\r\n", who);
//  while(1);



//  HAL_Delay(100);
//
//  HAL_Delay(20);
//  i2c_scan();  // stampa gli slave visti
////   prova entrambi gli indirizzi:
//  uint8_t who=0;
//  HAL_StatusTypeDef st;
//  st = HAL_I2C_Mem_Read(&hi2c1, 0x6B<<1, 0x0F, 1, &who, 1, 200);
//  printf("Try 0x6B WHO=0x%02X st=%d\r\n", who, st);
//  st = HAL_I2C_Mem_Read(&hi2c1, 0x6A<<1, 0x0F, 1, &who, 1, 200);
//  printf("Try 0x6A WHO=0x%02X st=%d\r\n", who, st);
//  while(1);

//  set_usart2_baud(38400);
//  HAL_UART_Transmit(&huart3, (uint8_t*)"Listen USART2 9600\r\n", 21, 100);
//  uint8_t ch;
//  for(;;){
//    if (HAL_UART_Receive(&huart2, &ch, 1, 500) == HAL_OK) {
//      HAL_UART_Transmit(&huart3, &ch, 1, 10);  // dovresti vedere $G...NMEA
//    } else {
//      HAL_UART_Transmit(&huart3, (uint8_t*)".", 1, 10); // nessun byte
//    }
//  }
  /* USER CODE BEGIN 2 */

//  GNSS_StartReception();



  /* USER CODE END 2 */

  /* Init scheduler */
  osKernelInitialize();  /* Call init function for freertos objects (in cmsis_os2.c) */
//  MX_FREERTOS_Init();

//  set_usart2_baud(38400);  // o 9600 se il tuo modulo è a 9600. Lascia quello che produce NMEA leggibili.
//   HAL_UART_Transmit(&huart3, (uint8_t*)"GNSS DMA+IDLE ready\r\n", 22, 100);

  /* Initialize leds */
  BSP_LED_Init(LED_GREEN);
  BSP_LED_Init(LED_YELLOW);
  BSP_LED_Init(LED_RED);

  /* Initialize USER push-button, will be used to trigger an interrupt each time it's pressed.*/
  BSP_PB_Init(BUTTON_USER, BUTTON_MODE_EXTI);

//  const osThreadAttr_t IMUTask_attributes = {
//    .name = "IMUTask",
//    .stack_size = 512 * 4,
//    .priority = (osPriority_t) osPriorityNormal,
//  };
//  osThreadNew(IMUTask, NULL, &IMUTask_attributes);

  // Task GNSS
  const osThreadAttr_t GNSSTask_attributes = {
    .name = "GNSSTask",
    .stack_size = 2048 * 4,           // un po’ più stack per parsing
    .priority = (osPriority_t) osPriorityBelowNormal, // o Normal
  };
  osThreadNew(GNSSTask, NULL, &GNSSTask_attributes);

  /* USER CODE BEGIN BSP */
  /* -- Sample board code to switch on leds ---- */
  BSP_LED_On(LED_GREEN);
  BSP_LED_On(LED_YELLOW);
  BSP_LED_On(LED_RED);
  /* USER CODE END BSP */

  /* Start scheduler */
  osKernelStart();

  /* We should never get here as control is now taken by the scheduler */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
  while (1)
  {
    /* USER CODE END WHILE */
//	  nmea_poll_and_print();
    /* USER CODE BEGIN 3 */
  }

  /* USER CODE END 3 */
}


static void GNSS_StartReception(void)
{
	printf("GNSS_StartReception\r\n");
  if (HAL_UARTEx_ReceiveToIdle_DMA(&huart2, nmea_dma_buf, NMEA_DMA_BUF_SZ) != HAL_OK) {
    printf("RX2 DMA start failed\r\n");
    Error_Handler();
  }
  if (huart2.hdmarx) __HAL_DMA_DISABLE_IT(huart2.hdmarx, DMA_IT_HT);
}

void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef *huart, uint16_t Size)
{
	if (huart->Instance == USART2) {
	    if (Size) {
	      rb_push(nmea_dma_buf, Size);
	      gnss_rx_bytes += Size;
	      gnss_last_rx_ms = HAL_GetTick();

	      // --- SOLO DEBUG: copia i primi 64 byte del chunk ---
	      uint16_t m = (Size > sizeof(dbg_last_bytes)) ? sizeof(dbg_last_bytes) : Size;
	      memcpy((void*)dbg_last_bytes, nmea_dma_buf, m);
	      dbg_last_size  = m;
	      dbg_rx_events++;
	    }
	    // riarmo
//	    GNSS_DMA_Start();
	  }
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
//void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef *huart, uint16_t Size)
//{
//  if (huart->Instance == USART3)
//  {
//    // Send message to queue from ISR
////    osMessageQueuePut(UartMessageHandle, &Size, 0, 0);
//  }
//}

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
void BSP_PB_Callback(Button_TypeDef Button)
{
  if (Button == BUTTON_USER)
  {
    BspButtonState = BUTTON_PRESSED;
  }
}

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
