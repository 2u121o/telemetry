// adc3_init.cpp
#include "stm32h7xx_hal.h"
#include "stm32h7xx_hal_adc.h"
#include "stm32h7xx_hal_adc_ex.h"
#include "stm32h7xx_hal_gpio.h"
#include "adc3_init.hpp"

ADC_HandleTypeDef hadc3;

void ADC3_PC2C_INP0_Init()
{
    __HAL_RCC_GPIOC_CLK_ENABLE();
    GPIO_InitTypeDef gp{};
    gp.Pin  = GPIO_PIN_2;              // PC2_C (A4)
    gp.Mode = GPIO_MODE_ANALOG;
    gp.Pull = GPIO_NOPULL;
    HAL_GPIO_Init(GPIOC, &gp);

    __HAL_RCC_SYSCFG_CLK_ENABLE();
    SYSCFG->PMCR |= SYSCFG_PMCR_PC2SO; // chiude lo switch analogico su PC2_C

    __HAL_RCC_ADC3_CLK_ENABLE();

    hadc3.Instance = ADC3;
    hadc3.Init.ClockPrescaler           = ADC_CLOCK_ASYNC_DIV4;
    hadc3.Init.Resolution               = ADC_RESOLUTION_12B;
    hadc3.Init.ScanConvMode             = ADC_SCAN_DISABLE;
    hadc3.Init.EOCSelection             = ADC_EOC_SINGLE_CONV;
    hadc3.Init.LowPowerAutoWait         = DISABLE;
    hadc3.Init.ContinuousConvMode       = DISABLE;
    hadc3.Init.NbrOfConversion          = 1;
    hadc3.Init.ExternalTrigConv         = ADC_SOFTWARE_START;
    hadc3.Init.ExternalTrigConvEdge     = ADC_EXTERNALTRIGCONVEDGE_NONE;
    hadc3.Init.ConversionDataManagement = ADC_CONVERSIONDATA_DR;
    hadc3.Init.Overrun                  = ADC_OVR_DATA_OVERWRITTEN;
    hadc3.Init.LeftBitShift             = ADC_LEFTBITSHIFT_NONE;
    hadc3.Init.OversamplingMode         = DISABLE;

    RCC_PeriphCLKInitTypeDef PeriphClkInit{};
    PeriphClkInit.PeriphClockSelection = RCC_PERIPHCLK_ADC;
    PeriphClkInit.AdcClockSelection    = RCC_ADCCLKSOURCE_CLKP; // usa PER_CK
    HAL_RCCEx_PeriphCLKConfig(&PeriphClkInit);

    // 2) Abilita i clock periferici necessari
    __HAL_RCC_SYSCFG_CLK_ENABLE();
    __HAL_RCC_ADC3_CLK_ENABLE();

    // (già fatto sopra) GPIOC clock + analog switch PC2_C:
    SYSCFG->PMCR |= SYSCFG_PMCR_PC2SO;

    HAL_ADC_Init(&hadc3);

    ADC_ChannelConfTypeDef s{};
    s.Channel      = ADC_CHANNEL_0;            // ADC3_INP0 -> PC2_C (A4)
    s.Rank         = ADC_REGULAR_RANK_1;
#if defined(ADC_SAMPLETIME_47CYCLES_5)
    s.SamplingTime = ADC_SAMPLETIME_47CYCLES_5;
#elif defined(ADC_SAMPLETIME_64CYCLES_5)
    s.SamplingTime = ADC_SAMPLETIME_64CYCLES_5;
#elif defined(ADC_SAMPLETIME_32CYCLES_5)
    s.SamplingTime = ADC_SAMPLETIME_32CYCLES_5;
#else
    s.SamplingTime = ADC_SAMPLETIME_2CYCLES_5; // estremo minimo: funziona ma meno filtrato
#endif
    s.SingleDiff   = ADC_SINGLE_ENDED;
    s.OffsetNumber = ADC_OFFSET_NONE;
    s.Offset       = 0;
    HAL_ADC_ConfigChannel(&hadc3, &s);

    HAL_ADCEx_Calibration_Start(&hadc3, ADC_CALIB_OFFSET, ADC_SINGLE_ENDED);
}

float ADC3_Read_V()
{
    HAL_ADC_Start(&hadc3);
    HAL_ADC_PollForConversion(&hadc3, HAL_MAX_DELAY);
    uint32_t raw = HAL_ADC_GetValue(&hadc3);
    HAL_ADC_Stop(&hadc3);
    return (raw * 3.3f) / 4095.0f;
}
