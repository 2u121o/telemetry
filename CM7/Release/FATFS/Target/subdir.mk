################################################################################
# Automatically-generated file. Do not edit!
# Toolchain: GNU Tools for STM32 (13.3.rel1)
################################################################################

# Add inputs and outputs from these tool invocations to the build variables 
C_SRCS += \
../FATFS/Target/user_diskio.c 

C_DEPS += \
./FATFS/Target/user_diskio.d 

OBJS += \
./FATFS/Target/user_diskio.o 


# Each subdirectory must supply rules for building sources it contributes
FATFS/Target/%.o FATFS/Target/%.su FATFS/Target/%.cyclo: ../FATFS/Target/%.c FATFS/Target/subdir.mk
	arm-none-eabi-gcc "$<" -mcpu=cortex-m7 -std=gnu11 -DCORE_CM7 -DUSE_HAL_DRIVER -DSTM32H755xx -DUSE_NUCLEO_64 -DUSE_PWR_DIRECT_SMPS_SUPPLY -c -I../Core/Inc -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/STM32H7xx_HAL_Driver/Inc -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/STM32H7xx_HAL_Driver/Inc/Legacy -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Middlewares/Third_Party/FreeRTOS/Source/include -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Middlewares/Third_Party/FreeRTOS/Source/CMSIS_RTOS_V2 -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Middlewares/Third_Party/FreeRTOS/Source/portable/GCC/ARM_CM4F -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/BSP/STM32H7xx_Nucleo -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/CMSIS/Device/ST/STM32H7xx/Include -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Drivers/CMSIS/Include -I../FATFS/Target -I../FATFS/App -I/home/dario/STM32Cube/Repository/STM32Cube_FW_H7_V1.12.1/Middlewares/Third_Party/FatFs/src -Os -ffunction-sections -fdata-sections -Wall -fstack-usage -fcyclomatic-complexity -MMD -MP -MF"$(@:%.o=%.d)" -MT"$@" --specs=nano.specs -mfpu=fpv5-d16 -mfloat-abi=hard -mthumb -o "$@"

clean: clean-FATFS-2f-Target

clean-FATFS-2f-Target:
	-$(RM) ./FATFS/Target/user_diskio.cyclo ./FATFS/Target/user_diskio.d ./FATFS/Target/user_diskio.o ./FATFS/Target/user_diskio.su

.PHONY: clean-FATFS-2f-Target

