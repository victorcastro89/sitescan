# Stage 1: Build
# Use the official Node.js LTS image
FROM node:20-alpine3.18 as builder

# Install necessary system dependencies for Puppeteer
RUN apk --no-cache add \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    yarn

# Set environment variables for Puppeteer
# To use installed chromium package
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser


# Set the working directory inside the container
WORKDIR /app

# Copy necessary files for installing dependencies
COPY package.json yarn.lock ./


COPY ./wappalyzer /app/wappalyzer 

# RUN yarn add wappalyzer@file:./wappalyzer/src/drivers/npm
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
# Use the official Node.js LTS image for the runtime stage
FROM node:20-alpine3.18

# Install necessary system dependencies for Puppeteer
RUN apk --no-cache add \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser

# Set the working directory inside the container
WORKDIR /app

# Copy necessary files from the builder stage
COPY --from=builder /app /app

# Copy the entry point script specifically to the desired location
COPY --from=builder /app/entrypoint.sh /usr/local/bin/

# Make sure the production dependencies are ready (if any were removed during build)
RUN yarn install --production --frozen-lockfile && \
    yarn cache clean

# Set the entry point script
ENTRYPOINT ["entrypoint.sh"]

# Command to run your app
CMD ["yarn", "start"]
