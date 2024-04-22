# Stage 1: Build
# Use the official Node.js LTS image based on slim version for better compatibility
FROM node:20-slim as builder

# Update and install necessary system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    fonts-freefont-ttf \
    --no-install-recommends

# Configure Google Chrome repository
RUN curl --silent --location https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends

    # Verify installation and check the path
RUN which google-chrome \
&& google-chrome --version


# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome


# Set the working directory inside the container
WORKDIR /app

# Copy necessary files for installing dependencies
COPY package.json yarn.lock ./


COPY ./wappalyzer /app/wappalyzer 

# Install dependencies including devDependencies needed for the build
RUN yarn install --frozen-lockfile

# Copy the rest of your application code
COPY src/ src/
COPY .swcrc .
COPY tsconfig.json .
COPY names.json .
COPY ./entrypoint.sh .
# Build the application
RUN yarn build

# Cleanup unnecessary files to prepare for the next stage
RUN rm -rf src node_modules/dev

# Stage 2: Runtime
# Use the same Node.js LTS image for the runtime stage
FROM node:20-slim

# Install Google Chrome in the runtime stage as well
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    --no-install-recommends \
    && curl --silent --location https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends

# Verify Chrome installation in runtime stage
RUN which google-chrome \
    && google-chrome --version



# Copy necessary system dependencies from the builder stage
COPY --from=builder /usr/bin/google-chrome /usr/bin/google-chrome

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# Set the working directory inside the container
WORKDIR /app

# Copy necessary files from the builder stage
COPY --from=builder /app /app

# Install production dependencies
RUN yarn install --production --frozen-lockfile && \
    yarn cache clean


# Set the entry point script
COPY --from=builder /app/entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]

# Command to run your app
CMD ["yarn", "start"]
