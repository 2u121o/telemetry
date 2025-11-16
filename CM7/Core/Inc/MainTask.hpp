#pragma once

extern "C" {
#include "i2c.h"
}

#include <iostream>

#include "GPS.hpp"
#include "Accelerometer.hpp"

#include "DataWriter.hpp"

#include "adc3_init.hpp"

namespace telemetry
{

class MainTask
{
	public:
	    static void start(void* arg);
		void run();

	private:
		GPS gps_;
		Accelerometer accelerometer_;

		GPSData gps_data_;
		IMUValues imu_values_;

		DataWriter data_writer_;

		char data[512];

//		volatile bool is_registration_stopped = true;


};

}//telemetry
