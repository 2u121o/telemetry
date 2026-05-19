################################################################################
# Automatically-generated file. Do not edit!
# Toolchain: GNU Tools for STM32 (13.3.rel1)
################################################################################

# Add inputs and outputs from these tool invocations to the build variables 
CPP_SRCS += \
../Core/Src/Accelerometer.cpp \
../Core/Src/DataWriter.cpp \
../Core/Src/GPS.cpp \
../Core/Src/MainTask.cpp \
../Core/Src/adc3_init.cpp \
../Core/Src/main.cpp 

C_SRCS += \
../Core/Src/dma.c \
../Core/Src/gpio.c \
../Core/Src/i2c.c \
../Core/Src/sd_spi.c \
../Core/Src/spi.c \
../Core/Src/stm32h7xx_hal_adc.c \
../Core/Src/stm32h7xx_hal_adc_ex.c \
../Core/Src/stm32h7xx_hal_msp.c \
../Core/Src/stm32h7xx_hal_timebase_tim.c \
../Core/Src/stm32h7xx_it.c \
../Core/Src/syscalls.c \
../Core/Src/sysmem.c \
../Core/Src/usart.c 

C_DEPS += \
./Core/Src/dma.d \
./Core/Src/gpio.d \
./Core/Src/i2c.d \
./Core/Src/sd_spi.d \
./Core/Src/spi.d \
./Core/Src/stm32h7xx_hal_adc.d \
./Core/Src/stm32h7xx_hal_adc_ex.d \
./Core/Src/stm32h7xx_hal_msp.d \
./Core/Src/stm32h7xx_hal_timebase_tim.d \
./Core/Src/stm32h7xx_it.d \
./Core/Src/syscalls.d \
./Core/Src/sysmem.d \
./Core/Src/usart.d 

OBJS += \
./Core/Src/Accelerometer.o \
./Core/Src/DataWriter.o \
./Core/Src/GPS.o \
./Core/Src/MainTask.o \
./Core/Src/adc3_init.o \
./Core/Src/dma.o \
./Core/Src/gpio.o \
./Core/Src/i2c.o \
./Core/Src/main.o \
./Core/Src/sd_spi.o \
./Core/Src/spi.o \
./Core/Src/stm32h7xx_hal_adc.o \
./Core/Src/stm32h7xx_hal_adc_ex.o \
./Core/Src/stm32h7xx_hal_msp.o \
./Core/Src/stm32h7xx_hal_timebase_tim.o \
./Core/Src/stm32h7xx_it.o \
./Core/Src/syscalls.o \
./Core/Src/sysmem.o \
./Core/Src/usart.o 

CPP_DEPS += \
./Core/Src/Accelerometer.d \
./Core/Src/DataWriter.d \
./Core/Src/GPS.d \
./Core/Src/MainTask.d \
./Core/Src/adc3_init.d \
./Core/Src/main.d 


# Each subdirectory must supply rules for building sources it contributes
Core/Src/%.o Core/Src/%.su Core/Src/%.cyclo: ../Core/Src/%.cpp Core/Src/subdir.mk
	arm-none-eabi-g++ "$<" -mcpu=cortex-m7 -std=gnu++14 -DCORE_CM7 -DUSE_HAL_DRIVER -DSTM32H755xx -DUSE_NUCLEO_64 -DUSE_PWR_DIRECT_SMPS_SUPPLY -c -I../Core/Inc -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/STM32H7xx_HAL_Driver/Inc -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/STM32H7xx_HAL_Driver/Inc/Legacy -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Middlewares/Third_Party/FreeRTOS/Source/include -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Middlewares/Third_Party/FreeRTOS/Source/CMSIS_RTOS_V2 -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Middlewares/Third_Party/FreeRTOS/Source/portable/GCC/ARM_CM4F -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/BSP/STM32H7xx_Nucleo -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/CMSIS/Device/ST/STM32H7xx/Include -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/CMSIS/Include -I../FATFS/Target -I../FATFS/App -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Middlewares/Third_Party/FatFs/src -Os -ffunction-sections -fdata-sections -fno-exceptions -fno-rtti -fno-use-cxa-atexit -Wall -fstack-usage -fcyclomatic-complexity -MMD -MP -MF"$(@:%.o=%.d)" -MT"$@" --specs=nano.specs -mfpu=fpv5-d16 -mfloat-abi=hard -mthumb -o "$@"
Core/Src/%.o Core/Src/%.su Core/Src/%.cyclo: ../Core/Src/%.c Core/Src/subdir.mk
	arm-none-eabi-gcc "$<" -mcpu=cortex-m7 -std=gnu11 -DCORE_CM7 -DUSE_HAL_DRIVER -DSTM32H755xx -DUSE_NUCLEO_64 -DUSE_PWR_DIRECT_SMPS_SUPPLY -c -I../Core/Inc -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/STM32H7xx_HAL_Driver/Inc -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/STM32H7xx_HAL_Driver/Inc/Legacy -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Middlewares/Third_Party/FreeRTOS/Source/include -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Middlewares/Third_Party/FreeRTOS/Source/CMSIS_RTOS_V2 -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Middlewares/Third_Party/FreeRTOS/Source/portable/GCC/ARM_CM4F -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/BSP/STM32H7xx_Nucleo -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/CMSIS/Device/ST/STM32H7xx/Include -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/CMSIS/Include -I../FATFS/Target -I../FATFS/App -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Middlewares/Third_Party/FatFs/src -Os -ffunction-sections -fdata-sections -Wall -fstack-usage -fcyclomatic-complexity -MMD -MP -MF"$(@:%.o=%.d)" -MT"$@" --specs=nano.specs -mfpu=fpv5-d16 -mfloat-abi=hard -mthumb -o "$@"

clean: clean-Core-2f-Src

clean-Core-2f-Src:
	-$(RM) ./Core/Src/Accelerometer.cyclo ./Core/Src/Accelerometer.d ./Core/Src/Accelerometer.o ./Core/Src/Accelerometer.su ./Core/Src/DataWriter.cyclo ./Core/Src/DataWriter.d ./Core/Src/DataWriter.o ./Core/Src/DataWriter.su ./Core/Src/GPS.cyclo ./Core/Src/GPS.d ./Core/Src/GPS.o ./Core/Src/GPS.su ./Core/Src/MainTask.cyclo ./Core/Src/MainTask.d ./Core/Src/MainTask.o ./Core/Src/MainTask.su ./Core/Src/adc3_init.cyclo ./Core/Src/adc3_init.d ./Core/Src/adc3_init.o ./Core/Src/adc3_init.su ./Core/Src/dma.cyclo ./Core/Src/dma.d ./Core/Src/dma.o ./Core/Src/dma.su ./Core/Src/gpio.cyclo ./Core/Src/gpio.d ./Core/Src/gpio.o ./Core/Src/gpio.su ./Core/Src/i2c.cyclo ./Core/Src/i2c.d ./Core/Src/i2c.o ./Core/Src/i2c.su ./Core/Src/main.cyclo ./Core/Src/main.d ./Core/Src/main.o ./Core/Src/main.su ./Core/Src/sd_spi.cyclo ./Core/Src/sd_spi.d ./Core/Src/sd_spi.o ./Core/Src/sd_spi.su ./Core/Src/spi.cyclo ./Core/Src/spi.d ./Core/Src/spi.o ./Core/Src/spi.su ./Core/Src/stm32h7xx_hal_adc.cyclo ./Core/Src/stm32h7xx_hal_adc.d ./Core/Src/stm32h7xx_hal_adc.o ./Core/Src/stm32h7xx_hal_adc.su ./Core/Src/stm32h7xx_hal_adc_ex.cyclo ./Core/Src/stm32h7xx_hal_adc_ex.d ./Core/Src/stm32h7xx_hal_adc_ex.o ./Core/Src/stm32h7xx_hal_adc_ex.su ./Core/Src/stm32h7xx_hal_msp.cyclo ./Core/Src/stm32h7xx_hal_msp.d ./Core/Src/stm32h7xx_hal_msp.o ./Core/Src/stm32h7xx_hal_msp.su ./Core/Src/stm32h7xx_hal_timebase_tim.cyclo ./Core/Src/stm32h7xx_hal_timebase_tim.d ./Core/Src/stm32h7xx_hal_timebase_tim.o ./Core/Src/stm32h7xx_hal_timebase_tim.su ./Core/Src/stm32h7xx_it.cyclo ./Core/Src/stm32h7xx_it.d ./Core/Src/stm32h7xx_it.o ./Core/Src/stm32h7xx_it.su ./Core/Src/syscalls.cyclo ./Core/Src/syscalls.d ./Core/Src/syscalls.o ./Core/Src/syscalls.su ./Core/Src/sysmem.cyclo ./Core/Src/sysmem.d ./Core/Src/sysmem.o ./Core/Src/sysmem.su ./Core/Src/usart.cyclo ./Core/Src/usart.d ./Core/Src/usart.o ./Core/Src/usart.su

.PHONY: clean-Core-2f-Src

