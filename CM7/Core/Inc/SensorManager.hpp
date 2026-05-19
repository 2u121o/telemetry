#pragma once
#include "Sensor.hpp"
#include <cstdio>
#include <cstring>

namespace telemetry
{

class SensorManager
{
public:
    static constexpr uint8_t MAX_SENSORS = 8;

    bool addSensor(Sensor* s)
    {
        if (count_ >= MAX_SENSORS) return false;
        sensors_[count_++] = s;
        return true;
    }

    bool initAll()
    {
        bool all_ok = true;
        for (uint8_t i = 0; i < count_; ++i)
        {
            if (!sensors_[i]->init()) all_ok = false;
        }
        return all_ok;
    }

    void readAll(uint32_t now_ms)
    {
        for (uint8_t i = 0; i < count_; ++i)
        {
            if (sensors_[i]->shouldSample(now_ms))
            {
                sensors_[i]->read();
                sensors_[i]->markSampled(now_ms);
            }
        }
    }

    int buildHeader(char* buf, size_t sz)
    {
        int pos = snprintf(buf, sz, "timestamp");
        for (uint8_t i = 0; i < count_; ++i)
        {
            const char* const* names = sensors_[i]->columnNames();
            for (uint8_t c = 0; c < sensors_[i]->columnCount(); ++c)
            {
                pos += snprintf(buf + pos, sz - pos, ",%s", names[c]);
            }
        }
        pos += snprintf(buf + pos, sz - pos, "\r\n");
        return pos;
    }

    int buildRow(uint32_t ts_ms, char* buf, size_t sz)
    {
        int pos = snprintf(buf, sz, "%lu", (unsigned long)ts_ms);

        float vals[16]; 
        for (uint8_t i = 0; i < count_; ++i)
        {
            sensors_[i]->fillValues(vals);
            for (uint8_t c = 0; c < sensors_[i]->columnCount(); ++c)
            {
                pos += snprintf(buf + pos, sz - pos, ",%.6f", (double)vals[c]);
            }
        }
        pos += snprintf(buf + pos, sz - pos, "\r\n");
        return pos;
    }

private:
    Sensor* sensors_[MAX_SENSORS] = {};
    uint8_t count_ = 0;
};

} // namespace telemetry