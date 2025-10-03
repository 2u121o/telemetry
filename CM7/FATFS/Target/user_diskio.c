/* USER CODE BEGIN Header */
/**
 ******************************************************************************
  * @file    user_diskio.c
  * @brief   Disk I/O driver per FatFs che usa SD in SPI (sd_spi.c)
  ******************************************************************************
  */
/* USER CODE END Header */

/* Includes ------------------------------------------------------------------*/
#include "user_diskio.h"
#include "ff_gen_drv.h"
#include "sd_spi.h"

/* Private variables ---------------------------------------------------------*/
static volatile DSTATUS Stat = STA_NOINIT;

/* Private function prototypes -----------------------------------------------*/
DSTATUS USER_initialize (BYTE pdrv);
DSTATUS USER_status (BYTE pdrv);
DRESULT USER_read (BYTE pdrv, BYTE *buff, DWORD sector, UINT count);
#if _USE_WRITE == 1
  DRESULT USER_write (BYTE pdrv, const BYTE *buff, DWORD sector, UINT count);
#endif
#if _USE_IOCTL == 1
  DRESULT USER_ioctl (BYTE pdrv, BYTE cmd, void *buff);
#endif

/* Driver structure exported a FatFs */
Diskio_drvTypeDef USER_Driver = {
  USER_initialize,
  USER_status,
  USER_read,
#if _USE_WRITE
  USER_write,
#endif
#if _USE_IOCTL
  USER_ioctl,
#endif
};

/* Functions -----------------------------------------------------------------*/
DSTATUS USER_initialize (BYTE pdrv)
{
	printf("USER_initialize pdrv=%u\r\n", pdrv);
	  DSTATUS s = STA_NOINIT;
	  int r = sd_init();
	  printf("sd_init -> %d\r\n", r);
	  s = (r==0) ? 0 : STA_NOINIT;
	  Stat = s;
	  return s;
}

DSTATUS USER_status (BYTE pdrv)
{
  if (pdrv != 0) return STA_NOINIT;
  return Stat;
}

DRESULT USER_read (BYTE pdrv, BYTE *buff, DWORD sector, UINT count)
{
	printf("USER_read LBA=%lu cnt=%u\r\n", (unsigned long)sector, (unsigned)count);
  if (pdrv != 0 || (Stat & STA_NOINIT)) return RES_NOTRDY;
  if (count == 0) return RES_PARERR;

  for (UINT i = 0; i < count; i++) {
    if (sd_read_block(sector + i, buff + (i * 512)) != 0) {
      return RES_ERROR;
    }
  }
  return RES_OK;
}

#if _USE_WRITE == 1
DRESULT USER_write (BYTE pdrv, const BYTE *buff, DWORD sector, UINT count)
{
  if (pdrv != 0 || (Stat & STA_NOINIT)) return RES_NOTRDY;

  for (UINT i=0; i<count; i++) {
    if (sd_write_block(sector + i, buff + i*512) != 0) {
      return RES_ERROR;
    }
  }
  return RES_OK;
}
#endif

#if _USE_IOCTL == 1
DRESULT USER_ioctl (BYTE pdrv, BYTE cmd, void *buff)
{
  if (pdrv != 0) return RES_PARERR;
  if (Stat & STA_NOINIT) return RES_NOTRDY;

  switch (cmd) {
    case CTRL_SYNC:        return RES_OK;
    case GET_SECTOR_SIZE:  *(WORD*)buff = 512; return RES_OK;
    case GET_BLOCK_SIZE:   *(DWORD*)buff = 1;  return RES_OK;
    case GET_SECTOR_COUNT: return RES_PARERR;  // opzionale
    default:               return RES_PARERR;
  }
}
#endif
