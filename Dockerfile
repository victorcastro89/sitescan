
FROM --platform=${TARGETPLATFORM} node:20-bullseye as builder

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && apt-get install -y chromium  libgbm-dev fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 dbus dbus-x11 dumb-init \
    --no-install-recommends \
    && service dbus start \
    && rm -rf /var/lib/apt/lists/*

# Adjust Puppeteer environment to use Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

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

#RUN npm install pm2 -g
# Build the application
RUN yarn build

# Cleanup unnecessary files to prepare for the next stage
RUN rm -rf src node_modules/dev

# Stage 2: Runtime

# Use the same Node.js LTS image for the runtime stage
FROM --platform=${TARGETPLATFORM} builder

# RUN apt-get update \
#     && apt-get install -y wget gnupg \
#     && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
#     && apt-get install -y chromium fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 dbus dbus-x11 dumb-init \
#     --no-install-recommends \
#     && service dbus start \
#     && rm -rf /var/lib/apt/lists/*


# Copy necessary system dependencies from the builder stage
COPY --from=builder /usr/bin/chromium /usr/bin/chromium
COPY --from=builder /usr/share/fonts /usr/share/fonts
COPY --from=builder  /usr/bin/dumb-init /usr/bin/dumb-init
# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set the working directory inside the container
WORKDIR /app

# Copy necessary files from the builder stage
COPY --from=builder /app /app

# Install production dependencies
RUN yarn install --production --frozen-lockfile && \
    yarn cache clean

# Set the entry point script
COPY --from=builder /app/entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["yarn", "start"]
