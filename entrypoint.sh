#!/bin/sh
# entrypoint.sh

# Initialize the command variable with the base command
cmd="yarn start"

# Check if CPU ( Number of process to spawn) variable is provided and append to the command
if [ ! -z "$CPU" ]; then
    cmd="$cmd --cpu $CPU"
fi

# Check if PT ( Parralel requests) variable is provided and append to the command
if [ ! -z "$PT" ]; then
    cmd="$cmd --pt $PT"
fi

# Check if RL ( max Ripestats SIMUTANEUS API requests LIMIT) variable is provided and append to the command
if [ ! -z "$RL" ]; then
    cmd="$cmd --rl $RL"
fi

# Echo the final command to be executed (useful for debugging)
echo "Executing command: $cmd"

# Execute the command
exec $cmd
