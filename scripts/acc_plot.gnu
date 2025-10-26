set datafile separator ","
plot "TEST.TXT" using 1:2 with lines, "TEST.TXT" using 1:3 with lines, "TEST.TXT" using 1:4 with lines
