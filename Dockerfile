# Define the base Node.js image with version 20
FROM ghcr.io/puppeteer/puppeteer:22.8.1

# Set the working directory
WORKDIR /app
USER root

# Install necessary packages including cron and dumb-init
RUN apt-get update && apt-get install -y cron dumb-init sudo

# Copy necessary files for installing dependencies
COPY package.json yarn.lock ./

# Copy the custom script and give execution permissions
COPY kill_long_running_chrome.sh /usr/local/bin/kill_long_running_chrome.sh
RUN chmod +x /usr/local/bin/kill_long_running_chrome.sh

# Setup the cron job
RUN (crontab -l 2>/dev/null; echo "*/6 * * * * /usr/bin/sudo /usr/local/bin/kill_long_running_chrome.sh >> /var/log/cron.log 2>&1") | crontab -

# Allow running the script with sudo without password prompt
RUN echo "root ALL=(ALL) NOPASSWD: /usr/local/bin/kill_long_running_chrome.sh" >> /etc/sudoers

COPY ./wappalyzer /app/wappalyzer 

# Copy the rest of your application code
COPY src/ src/
COPY .swcrc .
COPY tsconfig.json .
COPY names.json .
COPY ./entrypoint.sh .

# Install production dependencies
RUN yarn install --frozen-lockfile && \
    yarn cache clean

# Build the application
RUN yarn build

# Cleanup unnecessary files to prepare for the next stage
RUN rm -rf src node_modules/dev

# Cleanup
RUN rm -rf /var/lib/apt/lists/*

# Set the entry point script
COPY ./entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/usr/local/bin/entrypoint.sh"]

# Command to run your app
CMD ["yarn", "start"]
