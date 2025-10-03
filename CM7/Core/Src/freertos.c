/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * File Name          : freertos.c
  * Description        : Code for freertos applications
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

/* Includes ------------------------------------------------------------------*/
#include "FreeRTOS.h"
#include "task.h"
#include "main.h"
#include "cmsis_os.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */

/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */

/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */

/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/
/* USER CODE BEGIN Variables */

/* USER CODE END Variables */
/* Definitions for UartReception */
osThreadId_t UartReceptionHandle;
const osThreadAttr_t UartReception_attributes = {
  .name = "UartReception",
  .stack_size = 512 * 4,
  .priority = (osPriority_t) osPriorityNormal,
};
/* Definitions for UserButton */
osThreadId_t UserButtonHandle;
const osThreadAttr_t UserButton_attributes = {
  .name = "UserButton",
  .stack_size = 256 * 4,
  .priority = (osPriority_t) osPriorityBelowNormal,
};
/* Definitions for ButtonMessage */
osMessageQueueId_t ButtonMessageHandle;
const osMessageQueueAttr_t ButtonMessage_attributes = {
  .name = "ButtonMessage"
};
/* Definitions for UartMessage */
osMessageQueueId_t UartMessageHandle;
const osMessageQueueAttr_t UartMessage_attributes = {
  .name = "UartMessage"
};

/* Private function prototypes -----------------------------------------------*/
/* USER CODE BEGIN FunctionPrototypes */

/* USER CODE END FunctionPrototypes */

void UartReceptionTask(void *argument);
void UserButtonTask(void *argument);

void MX_FREERTOS_Init(void); /* (MISRA C 2004 rule 8.1) */

/**
  * @brief  FreeRTOS initialization
  * @param  None
  * @retval None
  */
void MX_FREERTOS_Init(void) {
  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* USER CODE BEGIN RTOS_MUTEX */
  /* add mutexes, ... */
  /* USER CODE END RTOS_MUTEX */

  /* USER CODE BEGIN RTOS_SEMAPHORES */
  /* add semaphores, ... */
  /* USER CODE END RTOS_SEMAPHORES */

  /* USER CODE BEGIN RTOS_TIMERS */
  /* start timers, add new ones, ... */
  /* USER CODE END RTOS_TIMERS */

  /* Create the queue(s) */
  /* creation of ButtonMessage */
  ButtonMessageHandle = osMessageQueueNew (16, sizeof(ButtonMessage_t), &ButtonMessage_attributes);

  /* creation of UartMessage */
  UartMessageHandle = osMessageQueueNew (40, sizeof(uint16_t), &UartMessage_attributes);

  /* USER CODE BEGIN RTOS_QUEUES */
  /* add queues, ... */
  /* USER CODE END RTOS_QUEUES */

  /* Create the thread(s) */
  /* creation of UartReception */
  UartReceptionHandle = osThreadNew(UartReceptionTask, NULL, &UartReception_attributes);

  /* creation of UserButton */
  UserButtonHandle = osThreadNew(UserButtonTask, NULL, &UserButton_attributes);

  /* USER CODE BEGIN RTOS_THREADS */
  /* add threads, ... */
  /* USER CODE END RTOS_THREADS */

  /* USER CODE BEGIN RTOS_EVENTS */
  /* add events, ... */
  /* USER CODE END RTOS_EVENTS */

}

/* USER CODE BEGIN Header_UartReceptionTask */
/**
  * @brief  Function implementing the UartReception thread.
  * @param  argument: Not used
  * @retval None
  */
/* USER CODE END Header_UartReceptionTask */
void UartReceptionTask(void *argument)
{
  /* USER CODE BEGIN UartReceptionTask */
  /* Infinite loop */
  for(;;)
  {
    osDelay(1);
  }
  /* USER CODE END UartReceptionTask */
}

/* USER CODE BEGIN Header_UserButtonTask */
/**
* @brief Function implementing the UserButton thread.
* @param argument: Not used
* @retval None
*/
/* USER CODE END Header_UserButtonTask */
void UserButtonTask(void *argument)
{
  /* USER CODE BEGIN UserButtonTask */
  /* Infinite loop */
  for(;;)
  {
    osDelay(1);
  }
  /* USER CODE END UserButtonTask */
}

/* Private application code --------------------------------------------------*/
/* USER CODE BEGIN Application */

/* USER CODE END Application */

