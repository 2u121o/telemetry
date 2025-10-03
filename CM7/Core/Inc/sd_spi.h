#ifndef __SD_SPI_H
#define __SD_SPI_H

#include <stdint.h>

// inizializza la SD in modalità SPI
int sd_init(void);

int sd_write_block(uint32_t lba, const uint8_t *buf);
// legge un settore da 512B
int sd_read_block(uint32_t lba, uint8_t *buf);

// (se vuoi anche scrivere in futuro)
// int sd_write_block(uint32_t lba, const uint8_t *buf);

#endif /* __SD_SPI_H */
