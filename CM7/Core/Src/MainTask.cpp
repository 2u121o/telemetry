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
	bool ret_init_acc = accelerometer_.init(&hi2c1);

	char* file_name = "test";
	char* header = "timestamp, ax, ay, az";
	if(!data_writer_.init(file_name, header))
	{
		return;
	}


	data_writer_.close();
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


