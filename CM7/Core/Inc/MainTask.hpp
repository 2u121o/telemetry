#pragma once

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
