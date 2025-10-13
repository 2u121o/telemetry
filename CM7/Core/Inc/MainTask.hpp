#pragma once

extern "C" {
#include "i2c.h"
}

#include <iostream>

#include "GPS.hpp"
#include "Accelerometer.hpp"

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
};

}//telemetry
