#!/bin/sh
# Run Docker container with specific environment variables, settings, and mount a file

docker run -e PT=10 -e CPU=2 -e RL=3 \
    --name scanner \
    --env-file ./.env \
    --network sitescan_app-network \
    -v "$(pwd)/domains.csv:/app/domains.csv" \
    victorfaria/sitescan
