#!/bin/bash

# Function to kill Chrome processes running for more than 2 minutes
kill_long_running_chrome() {
    local long_running_pids
    local count

    # Find all Chrome processes running longer than 2 minutes
    long_running_pids=$(ps -eo etime,pid,args | grep "[c]hrome" | awk '{
        split($1, time, "-");
        if (length(time) == 2) {
            # Day or hour part exists, definitely more than 300 seconds
            print $2;
        } else {
            split(time[1], t, ":");
            if (length(t) == 3 && (t[1]*3600 + t[2]*60 + t[3] > 300)) {
                # Format hh:mm:ss, more than 300 seconds
                print $2;
            } else if (length(t) == 2 && (t[1]*60 + t[2] > 300)) {
                # Format mm:ss, check if total time is more than 300 seconds
                print $2;
            }
        }
    }')

    # Count the number of processes to be killed
    count=$(echo "$long_running_pids" | wc -l)

    # Check if there are any processes to kill
    if [[ $count -gt 0 ]]; then
        # Attempt to kill the processes and handle possible permission issues
        for pid in $long_running_pids; do
            kill $pid 2>/dev/null || {
                printf "Failed to kill process %d: Operation not permitted\n" "$pid" >&2
            }
        done

        # Log the number of killed processes
        printf "Killed %d long-running Chrome process(es).\n" "$count" >&2
    else
        printf "No long-running Chrome processes found.\n" >&2
    fi

    return 0
}

# Main function to manage the script flow
main() {
    kill_long_running_chrome
}

# Run the main function
main