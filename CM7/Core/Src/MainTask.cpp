#include "MainTask.hpp"



namespace telemetry
{

static constexpr uint32_t EVT_BTN1 = (1u << 0);
static TaskHandle_t s_main_task_handle = nullptr;

void MainTask::start(void* arg)
{
	s_main_task_handle = xTaskGetCurrentTaskHandle();
    static_cast<MainTask*>(arg)->run();
}

void MainTask::run()
{

	MX_I2C1_Init();

//	HAL_Delay();
	bool ret_init_acc = accelerometer_.init(&hi2c1);
	if(gps_.init())
	{

	}

	char* file_name = "logaccgps";
	char* header = "timestamp, ax, ay, az, wx, wy, wz, lat, lon, alt_m, travel_r_v\r\n";
	if(!data_writer_.init(file_name, header))
	{

	}

	ADC3_PC2C_INP0_Init();

	bool is_registration_stopped = false;

	uint32_t ts_ms;

	while(true)
	{
		if(is_registration_stopped) continue;

		ts_ms = HAL_GetTick();

		HAL_StatusTypeDef ret_read = accelerometer_.readData(&imu_values_);
		if(ret_read != HAL_OK)
		{
//			printf("data not read\r\n");
		}

		gps_.readData(&gps_data_);

	    float volt_travel_rear = ADC3_Read_V();
		int n = snprintf(data, sizeof(data),
		                     "%lu,%.6f,%.6f,%.6f,%.6f,%.6f,%.6f,%.14f,%.14f,%.6f,%.6f\r\n",
		                     (unsigned long)ts_ms, (double)imu_values_.ax, (double)imu_values_.ay, (double)imu_values_.az,
							 	 	 	 	 	   (double)imu_values_.wx, (double)imu_values_.wy, (double)imu_values_.wz,
												   (double)gps_data_.lat, (double)gps_data_.lon, (double)gps_data_.alt_m, volt_travel_rear);

		if (n > 0) data_writer_.writeBatch(data);
		uint32_t notif = 0;
		if (xTaskNotifyWait(0, 0xFFFFFFFF, &notif, 0) == pdTRUE)
		{
			if (notif & EVT_BTN1)
			{
				data_writer_.close();
				is_registration_stopped = true;
				ts_ms = 0;
			}
		}

	}
	vTaskDelay(pdMS_TO_TICKS(5));
}


#ifdef __cplusplus
extern "C" {
#endif

void BSP_PB_Callback(Button_TypeDef Button)
{
    if (Button != BUTTON_USER) return;


    static uint32_t last = 0;
    uint32_t now = HAL_GetTick();
    if (now - last < 30) return;
    last = now;


    extern TaskHandle_t s_main_task_handle;
    BaseType_t hpw = pdFALSE;
    if (s_main_task_handle) {
        xTaskNotifyFromISR(s_main_task_handle, EVT_BTN1, eSetBits, &hpw);
        portYIELD_FROM_ISR(hpw);
    }
}


#ifdef __cplusplus
}
#endif


}//telemetry


