require('dotenv').config();
const projects = require('./projects');
const repos = require('./repos');
const commits = require('./commits');
const loc = require('./locstats');
const { BITBUCKET_PROJECT_KEY } = process.env;

async function updateAll() {
   
    await projects.syncProject(BITBUCKET_PROJECT_KEY);
    await repos.RepositoriesSyncWithBitbucket(BITBUCKET_PROJECT_KEY);
    await commits.CommitSync(); // Called once, remove duplicate calls
    await loc.syncAllRepositories();
}

async function main() {
    // Main execution function, waits for updateAll to complete before logging success.
    await updateAll();
    console.log("All updates completed successfully!");
}

main().then(() => console.log("Process finished with success!")).catch(console.error);
