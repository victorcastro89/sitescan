#!/bin/bash

# This script counts all Chrome processes running longer than 10 seconds.

# Using ps to select all processes, outputting elapsed time, PID, and command with arguments
# grep to filter for Chrome processes (ignoring the script itself by bracketing 'c' of chrome)
# awk checks if the first field (elapsed time) is greater than 10 seconds
# Elapsed time formats handled: [[dd-]hh:]mm:ss or mm:ss

count=$(ps -eo etime,pid,args | grep "[c]hrome" | awk '{
    split($1, time, "-");
    if (length(time) == 2) {
        # If theres a day or hour part, definitely more than 10 seconds
        print $0;
    } else {
        split(time[1], t, ":");
        if (length(t) == 3) {
            # Format hh:mm:ss, more than 0 seconds
            print $0;
        } else if (length(t) == 2) {
            # Format mm:ss, check if minutes are non-zero or seconds are greater than 10
            if (t[1] + 0 > 0 || t[2] + 0 > 10) print $0;
        } else if (length(t) == 1) {
            # Format ss, check if seconds are greater than 10
            if (t[1] + 0 > 10) print $0;
        }
    }
}' | wc -l)

echo "Number of Chrome processes running longer than 10 seconds: $count"
