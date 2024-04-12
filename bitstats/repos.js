
const db = require('./database');
const bitbucketClient = require('./bitConnection');
async function RepositoriesGetAll(projectKey) {
    const repositories = [];
    let isLastPage = false;
    let start = 0;

    while (!isLastPage) {
        try {
            const response = await bitbucketClient.get(`projects/${projectKey}/repos`, {
                params: { start, limit: 25 }, // Adjust limit as needed, up to 1000
            });
            
            repositories.push(...response.data.values);
            isLastPage = response.data.isLastPage;
            if (!isLastPage) {
                start = response.data.nextPageStart;
            }
        } catch (error) {
            console.error('Error fetching repositories:', error.message);
            break;
        }
    }

    return repositories;
}

// Function to save repository information to the database
async function RepositorySaveDb(repositoryObj) {


    try {
   
        // Insert or update the repository
        await db.query(
            `INSERT INTO repositories (id, name, slug, project_id,project_key) VALUES (?, ?, ?, ?,?)
            ON DUPLICATE KEY UPDATE name = VALUES(name), project_id = VALUES(project_id)`,
            [repositoryObj.id, repositoryObj.name, repositoryObj.slug, repositoryObj.project.id, repositoryObj.project.key]
        );
    } catch (error) {
        console.error('Error saving repository to the database:', error);
    } 
}
async function RepositoryfetchAllFromDb() {
    const rows = await db.query(`SELECT id FROM repositories`) ;
   
    return rows.map(row => row.id);
}

async function RepositoriesSyncWithBitbucket(projectKey) {

    try {
        const bitbucketRepos = await RepositoriesGetAll(projectKey);
        const dbRepoIds = await RepositoryfetchAllFromDb();

        // Convert database repository IDs to a set for easy lookup
        const dbRepoIdSet = new Set(dbRepoIds);

        // Iterate through Bitbucket repositories and insert only new ones
        for (const repo of bitbucketRepos) {
            if (!dbRepoIdSet.has(repo.id)) {

                // Repository is not present in the database, insert it
              await RepositorySaveDb({
                    id: repo.id,
                    name: repo.name,
                    slug: repo.slug,
                    project: {
                        id: repo.project.id,
                        key: repo.project.key,
                        name: repo.project.name,
                    },
                });
                console.log(`Repository ${repo.name} added to the database.`);
            }
        }
    } catch (error) {
        console.error('Error synchronizing repositories with Bitbucket:', error);
    } finally {
        console.error('All Repositories are in Sync with Bitbucket:');
        
}
}
module.exports = {
    RepositoriesGetAll,
    RepositorySaveDb,
    RepositoryfetchAllFromDb,
    RepositoriesSyncWithBitbucket
};