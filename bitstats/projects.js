
const db = require('./database');
const bitbucketClient = require('./bitConnection');
async function fetchProjectDetailsFromBitbucket(projectKey) {
    const bitbucketApiUrl = `${process.env.BITBUCKET_HOST}/rest/api/1.0/projects/${projectKey}`;
    try {
        const response = await bitbucketClient.get(bitbucketApiUrl);
        const { id, key, name } = response.data;
        return { id, project_key: key, name };
    } catch (error) {
        console.error(`Failed to fetch project details from Bitbucket for project key: ${projectKey}`, error);
        throw error;
    }
}
const   syncProject = async (projectKey) => {
    try {
        const projectDetails = await fetchProjectDetailsFromBitbucket(projectKey);

        const sql = `
            INSERT INTO projects (id, project_key, name)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE name = VALUES(name), id = VALUES(id)`;

        await db.query(sql, [projectDetails.id, projectDetails.project_key, projectDetails.name]);
        console.log(`Project ${projectDetails.name} (${projectDetails.project_key}) synced successfully.`);
    } catch (error) {
        console.error('Error syncing project with database:', error);
    }
}

module.exports = {syncProject};