#include "MainTask.hpp"



namespace telemetry
{

void MainTask::start(void* arg)
{
    static_cast<MainTask*>(arg)->run();
}

void MainTask::run()
{

	double gps_data, acc_data;

	while(true)
	{
		gps_data = gps_.getData();
		acc_data = accelerometer_.getData();
	}
}


}//telemetry


