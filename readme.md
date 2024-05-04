## .env WORKER
PG_HOST=localhost
PG_DATABASE=postgres
PG_USER=docker
PG_PASSWORD=docker
REDIS_HOST=localhost
REDIS_PWD=123456
RL=2
RIPE_CONCURRENCY=2
WAPPALIZER_CONCURRENCY=2
HTTP_CONCURRENCY=5
NSLOOKUP_CONCURRENCY=2
DB_CONCURRENCY=1
MAX_SOCKETS=25
LINESTOLOAD=5000000
BATCH_SIZE=4

DNSWORKER=true
HTTPWORKER=true
RIPEWORKER=true
WAPPALYZERWORKER=true
DBWORKER=false
PRODUCERWORKER=false

## .env Producer
PG_HOST=localhost
PG_DATABASE=postgres
PG_USER=docker
PG_PASSWORD=docker
REDIS_HOST=localhost
REDIS_PWD=123456
RL=6
RIPE_CONCURRENCY=1
WAPPALIZER_CONCURRENCY=1
HTTP_CONCURRENCY=3
NSLOOKUP_CONCURRENCY=3
DB_CONCURRENCY=1
MAX_SOCKETS=25
LINESTOLOAD=3000000
BATCH_SIZE=3

DNSWORKER=true
HTTPWORKER=true
RIPEWORKER=true
WAPPALYZERWORKER=true
DBWORKER=true
PRODUCERWORKER=true
## Install Puppeteer for Wappalyzer

sudo apt-get update
sudo apt-get install -y wget --no-install-recommends \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
    libgdk-pixbuf2.0-0 libgtk-3-0 libnspr4 libnss3 libx11 libgbm-dev  libxtst6  libxss1

npm install -g yarn
yarn add puppeteer


## Docker Commands
docker run --privileged --rm tonistiigi/binfmt --install all
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

 docker buildx create --name amdarm --use
docker buildx build --builder amdarm --platform linux/amd64,linux/arm64 -t victorfaria/sitescan:4.2 --push .


docker compose -f ./docker-compose-dev.yml up
## Knex Commands

npm install knex -g
yarn run up
yarn run down


## Seed DB

knex seed:make --knexfile knexfile.cjs --esm categories
knex seed:run --knexfile knexfile.cjs --esm


## Dev commands utils

FLush Redis
docker exec -it sitescan-redis-1 redis-cli
flushall

## Deploy
scp -i ~/.ssh/id_rsa DominiosONline202404180143.csv root@96.125.168.116:/root/sitescan/domains.csv
