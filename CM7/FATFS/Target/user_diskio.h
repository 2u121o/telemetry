/* USER CODE BEGIN Header */
/**
 ******************************************************************************
  * @file    user_diskio.h
  * @brief   This file contains the common defines and functions prototypes for
  *          the user_diskio driver.
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2025 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */
/* USER CODE END Header */

#ifndef __USER_DISKIO_H
#define __USER_DISKIO_H

#ifdef __cplusplus
 extern "C" {
#endif

#include "ff_gen_drv.h"   // definisce Diskio_drvTypeDef
#include "sd_spi.h"       // prototipi sd_init, sd_read_block

/* Exported driver structure */
extern Diskio_drvTypeDef USER_Driver;

#ifdef __cplusplus
}
#endif

#endif /* __USER_DISKIO_H */
