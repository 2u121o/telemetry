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

	IMUSensor   imu_sensor(1, &hi2c1, "imu1");           
    GPSSensor   gps_sensor(40);                  
    ADCSensor   adc_rear(1, "travel_r_v");    
	
	SensorManager mgr;
    mgr.addSensor(&imu_sensor);
    mgr.addSensor(&gps_sensor);
    mgr.addSensor(&adc_rear);
    mgr.initAll();

	GPSData gps_data;
	do {
		gps_sensor.read();
		gps_sensor.gpsDriver().readData(&gps_data); 
		vTaskDelay(pdMS_TO_TICKS(500));
	} while (!gps_data.have_date || gps_data.fix == 0);
	char file_name[32];
	snprintf(file_name, sizeof(file_name), "%.6s_%.6s", gps_data.date, gps_data.utc_hms);

	char header[256];
    mgr.buildHeader(header, sizeof(header));
	data_writer_.init(file_name, header);

	bool is_registration_stopped = false;

	static constexpr size_t BATCH_BUF_SZ = 4096;   
	static constexpr size_t FLUSH_THRESHOLD = 3072; 

	static char batch_buf[BATCH_BUF_SZ];
	size_t batch_pos = 0;


	while(true)
	{
		if(is_registration_stopped) continue;

		uint32_t ts = HAL_GetTick();
        mgr.readAll(ts);

        char row[256];
		int row_len = mgr.buildRow(ts, row, sizeof(row));

		if (row_len > 0 && (batch_pos + row_len) < BATCH_BUF_SZ)
		{
			memcpy(batch_buf + batch_pos, row, row_len);
			batch_pos += row_len;
		}

		if (batch_pos >= FLUSH_THRESHOLD)
		{
			batch_buf[batch_pos] = '\0';
			data_writer_.writeBatch(batch_buf);
			batch_pos = 0;
		}

		uint32_t notif = 0;
		if (xTaskNotifyWait(0, 0xFFFFFFFF, &notif, 0) == pdTRUE)
		{
			if (notif & EVT_BTN1)
			{
				if (batch_pos > 0)
				{
					batch_buf[batch_pos] = '\0';
					data_writer_.writeBatch(batch_buf);
					batch_pos = 0;
				}
				data_writer_.close();
				is_registration_stopped = true;
			}
		}

		vTaskDelay(pdMS_TO_TICKS(1));
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


