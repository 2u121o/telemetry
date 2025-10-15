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
	HAL_Delay(100);
	bool ret_init_acc = accelerometer_.init(&hi2c1);

	char* file_name = "test";
	char* header = "timestamp, ax, ay, az\r\n";
	if(!data_writer_.init(file_name, header))
	{

	}

	is_registration_stopped = false;
	char data[512];
	uint32_t ts_ms;
//	data_writer_.close();
	while(true)
	{
		if(is_registration_stopped) continue;

		ts_ms = HAL_GetTick();
		float ax;
		float ay;
		float az;

		HAL_StatusTypeDef ret_read = accelerometer_.readData(&ax, &ay, &az);
		if(ret_read != HAL_OK)
		{
//			printf("data not read\r\n");
		}

		int n = snprintf(data, sizeof(data),
		                     "%lu,%.6f,%.6f,%.6f\r\n",
		                     (unsigned long)ts_ms, (double)ax, (double)ay, (double)az);

		data_writer_.writeBatch(data);
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


