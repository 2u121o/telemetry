#pragma once
#include "stm32h7xx_hal_conf.h"

#ifdef __cplusplus
extern "C" {
#endif
void ADC3_PC2C_INP0_Init();
float ADC3_Read_V();
#ifdef __cplusplus
}
#endif
