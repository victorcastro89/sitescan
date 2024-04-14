#!/bin/sh
# Run Docker container with specific environment variables, settings, and mount a file

docker run --network="host" -e PT=6  -e RL=1 -d  --name scanner --env-file ./.env -v "$(pwd)/domains.csv:/app/domains.csv" victorfaria/sitescan
