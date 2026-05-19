#pragma once

extern "C" {
#include "i2c.h"
}

#include "DataWriter.hpp"
#include "IMU.hpp"
#include "ADCSensor.hpp"
#include "GPSSensor.hpp"

#include "SensorManager.hpp"

namespace telemetry
{

class MainTask
{
	public:
	    static void start(void* arg);
		void run();

	private:

		DataWriter data_writer_;


};

}//telemetry
