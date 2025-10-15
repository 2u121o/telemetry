#pragma once

extern "C" {
#include "i2c.h"
}

#include <iostream>

#include "GPS.hpp"
#include "Accelerometer.hpp"

#include "DataWriter.hpp"

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

		DataWriter data_writer_;

		bool is_registration_stopped = true;


};

}//telemetry
