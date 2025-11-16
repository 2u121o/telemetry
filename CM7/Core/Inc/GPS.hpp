#pragma once

#include <cstdint>
#include <cstring>
#include <cstdlib>
#include "usart.h"
#include <cmath>

namespace telemetry
{

struct ConfigGPS
{
  // Keep in flash, not modified
  const uint8_t UBX_CFG_RATE_4HZ[14] = {
    0xB5,0x62, 0x06,0x08, 0x06,0x00, 0xFA,0x00, 0x01,0x00, 0x00,0x00, 0x0F,0x94
  };

  const uint8_t UBX_MSG_GGA_UART1_1[16] = { // NMEA GxGGA (0xF0 0x00)
    0xB5,0x62,0x06,0x01,0x08,0x00, 0xF0,0x00, 0x00,0x01,0x00,0x00,0x00,0x00, 0x28,0x2C
  };
  const uint8_t UBX_MSG_RMC_UART1_1[16] = { // NMEA GxRMC (0xF0 0x04)
    0xB5,0x62,0x06,0x01,0x08,0x00, 0xF0,0x04, 0x00,0x01,0x00,0x00,0x00,0x00, 0x2C,0x3C
  };
  const uint8_t UBX_MSG_VTG_UART1_1[16] = { // NMEA GxVTG (0xF0 0x05)
    0xB5,0x62,0x06,0x01,0x08,0x00, 0xF0,0x05, 0x00,0x01,0x00,0x00,0x00,0x00, 0x2D,0x42
  };
  const uint8_t UBX_MSG_GLL_OFF[16] = { // GxGLL (0xF0 0x01)
    0xB5,0x62,0x06,0x01,0x08,0x00, 0xF0,0x01, 0x00,0x00,0x00,0x00,0x00,0x00, 0x00,0x2A
  };
  const uint8_t UBX_MSG_GSA_OFF[16] = { // GxGSA (0xF0 0x02)
    0xB5,0x62,0x06,0x01,0x08,0x00, 0xF0,0x02, 0x00,0x00,0x00,0x00,0x00,0x00, 0x01,0x31
  };
  const uint8_t UBX_MSG_GSV_OFF[16] = { // GxGSV (0xF0 0x03)
    0xB5,0x62,0x06,0x01,0x08,0x00, 0xF0,0x03, 0x00,0x00,0x00,0x00,0x00,0x00, 0x02,0x38
  };
};

struct GPSData
{
  char     utc_hms[16];
  char     date[8]; // ddmmyy
  double   lat = 0.0, lon = 0.0;
  int      have_ll = 0;
  int      fix = 0, sats = 0;
  double   hdop = 0.0, alt_m = 0.0;
  double   speed_kn = 0.0, course_deg = 0.0;

  uint32_t t_gga_ms = 0;
  uint32_t t_rmc_ms = 0;
  uint32_t t_vtg_ms = 0;
  uint32_t last_logged_gga_ms = 0;

  uint8_t  have_date = 0;
};

class GPS
{
public:
  bool init();                       // configure module + start DMA
  void readData(GPSData* out_data);  // non-blocking copy of last data

  // Called by the C wrapper
  void onRxEvent(UART_HandleTypeDef *huart, uint16_t Size);

private:
  // config
  ConfigGPS config_gps_;

  // state
  GPSData gps_data_{};

  // DMA buffer
  static constexpr uint16_t NMEA_DMA_BUF_SZ = 256;
  static uint8_t nmea_dma_buf_[NMEA_DMA_BUF_SZ];


  // ring buffer
  static constexpr uint16_t NMEA_RING_SZ = 1024;
  uint8_t nmea_ring_[NMEA_RING_SZ];
  volatile uint16_t rb_head_ = 0;
  volatile uint16_t rb_tail_ = 0;

  // diagnostics/time
  uint32_t start_ms_ = 0;
  volatile uint32_t gnss_rx_bytes_   = 0;
  volatile uint32_t gnss_last_rx_ms_ = 0;
  uint8_t          dbg_last_bytes_[64];
  volatile uint16_t dbg_last_size_ = 0;
  volatile uint32_t dbg_rx_events_ = 0;

  int num_tentative_start_ = 0;
  const int NUM_MAX_TENTATIVE = 10;

  // HAL helpers
  bool GNSSDMAStart();

  // NMEA helpers
  void   nmeaPoll();
  int    nmeaCheckCs(const char *s);
  int    rbPopByte(uint8_t *b);
  void   rbPush(const uint8_t *data, uint16_t len);
  static int nmea_parse_latlon(const char* ddmm, char hemi, double* out, int is_lat);
};

} // namespace telemetry

// C wrapper visible to HAL (implemented in GPS.cpp)
extern "C" void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef *huart, uint16_t Size);
