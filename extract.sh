#!/bin/bash

# Define the output file and ensure it starts as an empty array
outputFile="/home/victor/domainData/output.json"

echo -n "[]" > "$outputFile"
directoryPath="/home/victor/domainData/wappalyzer/src/drivers/npm/technologies"
cd $directoryPath

# Loop through each JSON file in the specified directory
for file in ${directoryPath}/*.json; do
  # Parse each file and append the required structure to the output file
  jq -r -c 'to_entries | .[] | select(.value.cats[] == 88) | {Hosting: .key, regex: ( .key | ascii_downcase ), DNS: .value.dns.SOA}' "$file" | while read -r line; do
    # Update the outputFile with the new entry
    jq --argjson newEntry "$line" '. += [$newEntry]' "$outputFile" > tmp.$$.json && mv tmp.$$.json "$outputFile"
  done
done

# Print the final output file
echo "Output saved to $outputFile"
jq '.' "$outputFile"
