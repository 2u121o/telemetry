#include "MainTask.hpp"



namespace telemetry
{

void MainTask::start(void* arg)
{

    static_cast<MainTask*>(arg)->run();
}

void MainTask::run()
{

	MX_I2C1_Init();
	HAL_Delay(100);
	HAL_StatusTypeDef ret_init = accelerometer_.init(&hi2c1);
	while (ret_init != HAL_OK)
	{
		ret_init = accelerometer_.init(&hi2c1);
	}


	while(true)
	{
		float ax;
		float ay;
		float az;

		HAL_StatusTypeDef ret_read = accelerometer_.readData(&ax, &ay, &az);
		if(ret_read != HAL_OK)
		{
			printf("data not read\r\n");
		}

	}
}


}//telemetry


