#include "GPS.hpp"


extern UART_HandleTypeDef huart2;

namespace telemetry
{

#if defined(__ICCARM__)
  #pragma location=".RAM_D2"
  __no_init uint8_t GPS::nmea_dma_buf_[GPS::NMEA_DMA_BUF_SZ];
#else
  __attribute__((section(".RAM_D2"))) __attribute__((aligned(32)))
  uint8_t GPS::nmea_dma_buf_[GPS::NMEA_DMA_BUF_SZ];
#endif

static GPS* s_gps_instance = nullptr;


bool GPS::init()
{
  s_gps_instance = this;

  GNSSDMAStart();

  HAL_UART_Transmit(&huart2, const_cast<uint8_t*>(config_gps_.UBX_CFG_RATE_4HZ),
                    sizeof(config_gps_.UBX_CFG_RATE_4HZ), 100);
//  HAL_Delay(50);
  HAL_UART_Transmit(&huart2, const_cast<uint8_t*>(config_gps_.UBX_MSG_GGA_UART1_1),
                    sizeof(config_gps_.UBX_MSG_GGA_UART1_1), 100);
  HAL_UART_Transmit(&huart2, const_cast<uint8_t*>(config_gps_.UBX_MSG_RMC_UART1_1),
                    sizeof(config_gps_.UBX_MSG_RMC_UART1_1), 100);
  HAL_UART_Transmit(&huart2, const_cast<uint8_t*>(config_gps_.UBX_MSG_VTG_UART1_1),
                    sizeof(config_gps_.UBX_MSG_VTG_UART1_1), 100);
//  HAL_Delay(50);
  HAL_UART_Transmit(&huart2, const_cast<uint8_t*>(config_gps_.UBX_MSG_GLL_OFF),
                    sizeof(config_gps_.UBX_MSG_GLL_OFF), 100);
  HAL_UART_Transmit(&huart2, const_cast<uint8_t*>(config_gps_.UBX_MSG_GSA_OFF),
                    sizeof(config_gps_.UBX_MSG_GSA_OFF), 100);
  HAL_UART_Transmit(&huart2, const_cast<uint8_t*>(config_gps_.UBX_MSG_GSV_OFF),
                    sizeof(config_gps_.UBX_MSG_GSV_OFF), 100);
  HAL_Delay(100);
  std::memset(nmea_ring_, 0, sizeof(nmea_ring_));
  rb_head_ = rb_tail_ = 0;


  return true;
}

void GPS::GNSSDMAStart()
{
	if (huart2.hdmarx == nullptr) return;

	  // stop RX pendente e DMA
	  HAL_UART_AbortReceive(&huart2);
	  if (huart2.hdmarx) HAL_DMA_Abort(huart2.hdmarx);

	  // disabilita UART, pulisci errori, flush RX, riabilita
	  __HAL_UART_DISABLE(&huart2);

	  __HAL_UART_CLEAR_PEFLAG(&huart2);
	  __HAL_UART_CLEAR_FEFLAG(&huart2);
	  __HAL_UART_CLEAR_NEFLAG(&huart2);
	  __HAL_UART_CLEAR_OREFLAG(&huart2);
	  __HAL_UART_CLEAR_IDLEFLAG(&huart2);

	  // flush RX FIFO (macro specifica H7)
	  __HAL_UART_SEND_REQ(&huart2, UART_RXDATA_FLUSH_REQUEST);

	  huart2.ErrorCode = HAL_UART_ERROR_NONE;

	  __HAL_UART_ENABLE(&huart2);
	  __DSB(); __ISB();

	  // cache maintenance se RAM cacheable
	  uintptr_t addr = reinterpret_cast<uintptr_t>(nmea_dma_buf_);
	  uintptr_t base = addr & ~0x1FUL;
	  uint32_t  size = ((NMEA_DMA_BUF_SZ + 31U) & ~31U);
	  SCB_CleanInvalidateDCache_by_Addr(reinterpret_cast<uint32_t*>(base), size);

	  // avvio RX ToIdle (USART2 RX DMA deve essere in DMA_NORMAL e linkato)
	  HAL_StatusTypeDef s = HAL_UARTEx_ReceiveToIdle_DMA(&huart2, nmea_dma_buf_, NMEA_DMA_BUF_SZ);
	  if (s != HAL_OK) {
	    // se ancora HAL_ERROR, non è più ORE: è DMA/IRQ/Request/Link
	    return;
	  }
//	  if (huart2.hdmarx) __HAL_DMA_DISABLE_IT(huart2.hdmarx, DMA_IT_HT);
	  if (huart2.hdmarx)
	  {
	    __HAL_DMA_ENABLE_IT(huart2.hdmarx, DMA_IT_HT | DMA_IT_TC);
	  }

	  start_ms_ = HAL_GetTick();
}

void GPS::readData(GPSData* out_data)
{
  const uint32_t now = HAL_GetTick();
  if (now - start_ms_ >= 1000) {
    start_ms_ = now;
    const uint32_t age = now - gnss_last_rx_ms_;
    if (age > 3000) {
      GNSSDMAStart();
    }
  }
  nmeaPoll();
  if (out_data) { *out_data = gps_data_; }

}

void GPS::rbPush(const uint8_t *data, uint16_t len)
{
  for (uint16_t i = 0; i < len; ++i) {
    uint16_t next = static_cast<uint16_t>((rb_head_ + 1) % NMEA_RING_SZ);
    if (next == rb_tail_) { rb_tail_ = static_cast<uint16_t>((rb_tail_ + 1) % NMEA_RING_SZ); }
    nmea_ring_[rb_head_] = data[i];
    rb_head_ = next;
  }
}

int GPS::rbPopByte(uint8_t *b)
{
  if (rb_head_ == rb_tail_) return 0;
  *b = nmea_ring_[rb_tail_];
  rb_tail_ = static_cast<uint16_t>((rb_tail_ + 1) % NMEA_RING_SZ);
  return 1;
}

int GPS::nmeaCheckCs(const char *s)
{
  if (s[0] != '$') return 0;
  const char *star = nullptr;
  uint8_t cs = 0;
  for (const char *p = s + 1; *p; ++p) {
    if (*p == '*') { star = p; break; }
    cs ^= static_cast<uint8_t>(*p);
  }
  if (!star || !star[1] || !star[2]) return 0;
  uint8_t want = static_cast<uint8_t>(strtoul(star + 1, nullptr, 16));
  return cs == want;
}

int GPS::nmea_parse_latlon(const char* ddmm, char hemi, double* out, int is_lat)
{
  if (!ddmm || !*ddmm || !out) return 0;

  const char* dot = std::strchr(ddmm, '.');
  if (!dot) return 0;

  int deg = 0;
  double min = 0.0;

  if (is_lat) {
    if ((dot - ddmm) < 2) return 0;
    char d2[3] = { ddmm[0], ddmm[1], 0 };
    deg = std::atoi(d2);
    min = std::atof(ddmm + 2);
  } else {
    if ((dot - ddmm) < 3) return 0;
    char d3[4] = { ddmm[0], ddmm[1], ddmm[2], 0 };
    deg = std::atoi(d3);
    min = std::atof(ddmm + 3);
  }

  double sign = 1.0;
  if (is_lat) { if (hemi == 'S' || hemi == 's') sign = -1.0; }
  else        { if (hemi == 'W' || hemi == 'w') sign = -1.0; }

  *out = sign * (static_cast<double>(deg) + (min / 60.0));
  return 1;
}

void GPS::nmeaPoll()
{
  static char line[128];
  static uint16_t L = 0;
  uint8_t b;

  int ret_pop_byte = rbPopByte(&b);
  while (ret_pop_byte) {
	  ret_pop_byte = rbPopByte(&b);
    if (b == '\r') continue;
    if (b == '\n') {
      line[L] = 0;
      if (L >= 9 && line[0] == '$' && nmeaCheckCs(line)) {

        if (std::strstr(line, "GGA,")) {
          gps_data_.t_gga_ms = HAL_GetTick();
          char *p = line;

          p = std::strchr(p, ','); if(!p) goto next; p++;
          char *comma = std::strchr(p, ','); if(!comma) goto next;
          *comma = 0;
          std::strncpy(gps_data_.utc_hms, p, sizeof(gps_data_.utc_hms)-1);
          gps_data_.utc_hms[sizeof(gps_data_.utc_hms)-1] = 0;
          p = comma + 1;

          char *lat = p;
          p = std::strchr(p, ','); if (!p) goto next; *p = 0; p++;
          if (*p == 0 || *p == ',') goto next;
          char hemiNS = *p;
          p = std::strchr(p, ','); if (!p) goto next; p++;

          char *lon = p;
          p = std::strchr(p, ','); if (!p) goto next; *p = 0; p++;
          if (*p == 0 || *p == ',') goto next;
          char hemiEW = *p;
          p = std::strchr(p, ','); if (!p) goto next; p++;

          gps_data_.fix = std::atoi(p);
          p = std::strchr(p, ','); if(!p) goto next; p++;

          gps_data_.sats = std::atoi(p);
          p = std::strchr(p, ','); if(!p) goto next; p++;

          gps_data_.hdop = std::atof(p);
          p = std::strchr(p, ','); if(!p) goto next; p++;

          gps_data_.alt_m = std::atof(p);

          double dlat=0, dlon=0;
          if (nmea_parse_latlon(lat, hemiNS, &dlat, 1) &&
              nmea_parse_latlon(lon, hemiEW, &dlon, 0)) {
            gps_data_.lat = dlat; gps_data_.lon = dlon; gps_data_.have_ll = 1;
          }
          gps_data_.t_gga_ms = HAL_GetTick();
        }
        else if (std::strstr(line, "RMC,")) {
          char *p = line;

          p = std::strchr(p, ','); if(!p) goto next; p++;
          char *comma = std::strchr(p, ','); if(!comma) goto next;
          *comma = 0;
          std::strncpy(gps_data_.utc_hms, p, sizeof(gps_data_.utc_hms)-1);
          gps_data_.utc_hms[sizeof(gps_data_.utc_hms)-1]=0;
          p = comma+1;

          char status = *p;
          p = std::strchr(p, ','); if(!p) goto next; p++;

          char *lat = p;
          p = std::strchr(p, ','); if(!p) goto next; *p = 0; p++;
          char hemiNS = *p;
          p = std::strchr(p, ','); if(!p) goto next; p++;

          char *lon = p;
          p = std::strchr(p, ','); if(!p) goto next; *p = 0; p++;
          char hemiEW = *p;
          p = std::strchr(p, ','); if(!p) goto next; p++;

          gps_data_.speed_kn = std::atof(p);
          p = std::strchr(p, ','); if(!p) goto next; p++;

          gps_data_.course_deg = std::atof(p);
          p = std::strchr(p, ','); if(!p) goto next; p++;

          char *date_start = p;
          comma = std::strchr(p, ',');
          if (comma) *comma = 0;
          std::strncpy(gps_data_.date, date_start, sizeof(gps_data_.date)-1);
          gps_data_.date[sizeof(gps_data_.date)-1] = 0;
          gps_data_.t_rmc_ms  = HAL_GetTick();
          gps_data_.have_date = (gps_data_.date[0] != 0);

          double dlat=0, dlon=0;
          int ok_lat = nmea_parse_latlon(lat, hemiNS, &dlat, 1);
          int ok_lon = nmea_parse_latlon(lon, hemiEW, &dlon, 0);
          if (ok_lat && ok_lon && status == 'A') {
            gps_data_.lat = dlat;
            gps_data_.lon = dlon;
            gps_data_.have_ll = 1;
          }
        }
        else if (std::strstr(line, "VTG,")) {
          char *p = line;
          p = std::strchr(p, ','); if(!p) goto next; p++;

          if (*p != ',') gps_data_.course_deg = std::atof(p);
          p = std::strchr(p, ','); if(!p) goto next; p++;  // T
          p = std::strchr(p, ','); if(!p) goto next; p++;  // course_m
          p = std::strchr(p, ','); if(!p) goto next; p++;  // M

          if (*p != ',') gps_data_.speed_kn = std::atof(p);
          p = std::strchr(p, ','); if(!p) goto next; p++;  // N

          gps_data_.t_vtg_ms = HAL_GetTick();
        }
      }
next:
      L = 0;
    } else {
      if (L < sizeof(line) - 1) line[L++] = static_cast<char>(b);
      else L = 0;
    }
  }
}

void GPS::onRxEvent(UART_HandleTypeDef *huart, uint16_t Size)
{
  if (huart->Instance != USART2) return;
  if (!Size) return;

  rbPush(nmea_dma_buf_, Size);
  gnss_rx_bytes_ += Size;
  gnss_last_rx_ms_ = HAL_GetTick();
  uint16_t m = (Size > sizeof(dbg_last_bytes_)) ? sizeof(dbg_last_bytes_) : Size;
  dbg_last_size_  = m;
  dbg_rx_events_++;
}

} // namespace telemetry

extern "C" void HAL_UARTEx_RxEventCallback(UART_HandleTypeDef *huart, uint16_t Size)
{
  if (telemetry::s_gps_instance) {
    telemetry::s_gps_instance->onRxEvent(huart, Size);
  }
}
