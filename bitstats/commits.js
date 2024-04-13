const db = require('./database');
const bitbucketClient = require('./bitConnection');
const moment = require('moment');

async function getLatestCommitId(repositoryId) {
    try {
        const rows = await db.query('SELECT commit_id FROM commits WHERE repository_id = ? ORDER BY committer_timestamp ASC LIMIT 1', [repositoryId]);
        return rows.length > 0 ? rows[0].commit_id : null;
    } catch (error) {
        console.error(`Error getting latest commit ID for repository ID ${repositoryId}: ${error}`);
        throw error;
    }
}
async function fetchAndSaveCommits(repoId, repositorySlug, projectKey, projectId) {
    try {
        let isLastPage = false;
        let start = 0;
        const limit = 10000; // Consider the Bitbucket API's rate limiting
        let params = { start, limit };
        let totalRowsFromAPI = 0; // Counter for rows returned from API
        let totalRowsSaved = 0; // Counter for rows saved to database
        console.log(`Fetching ${repoId} - ${repositorySlug} in project ${projectKey} in projectID ${projectId}`);

        while (!isLastPage) {
            console.log(`Getting data from ${repositorySlug} in project ${projectKey}`);
            const response = await bitbucketClient.get(`projects/${projectKey}/repos/${repositorySlug}/commits`, { params });
            
            if (response.data.values && response.data.values.length > 0) {
                totalRowsFromAPI += response.data.values.length; // Update counter for API rows
                const chunkSize = 1000
                for (let i = 0; i < response.data.values.length; i += chunkSize) {
                    const chunk = response.data.values.slice(i, i + chunkSize);
                    // Verifica se algum dos commits no chunk já existe no banco de dados
                    for (const commit of chunk) {
                        const existingCommit = await db.query('SELECT commit_id FROM commits WHERE commit_id = ? and  repository_id = ?', [commit.id,repoId]);
                        if (existingCommit.length > 0) {
                            console.log('Commit already exists, stopping sync.');
                            return; // Finaliza a função prematuramente se encontrar um commit existente
                        }
                    }

                    // Continua com a lógica de inserção se nenhum commit no chunk existir no banco
                    const values = chunk.map(commit => {
                        const { id, author, authorTimestamp, committer, committerTimestamp, message, properties } = commit;
                        const jiraKey = properties && properties['jira-key'] ? properties['jira-key'][0] : null;
                        return [
                            id, repositorySlug, repoId, projectKey, projectId, author.name, author.emailAddress,
                            committer.name, committer.emailAddress, committerTimestamp, authorTimestamp, message, jiraKey
                        ];
                    }).flat();

                    const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?,?,FROM_UNIXTIME(? / 1000),FROM_UNIXTIME(? / 1000),?,?)').join(',');
                    const query = `
                        INSERT INTO commits (commit_id, repository_slug, repository_id, project_key, project_id, author_name, author_email, committer_name, committer_email, committer_timestamp, author_timestamp, message, jira_key)
                        VALUES ${placeholders}`;
                    try {
                        const result = await db.query(query, values);
                        totalRowsSaved += result.affectedRows; // Update counter for saved rows
                        console.log(`Batch ${Math.ceil((i + chunkSize) / chunkSize)}: Saved ${chunk.length} commits. Total saved so far: ${totalRowsSaved} -Afected ${result.affectedRows} `);
                    } catch (error) {
                        console.error(`Error saving chunk: ${error}`);
                    }
                }
            } else {
                console.log(`No values found for ${repositorySlug} in project ${projectKey}`);
            }

            isLastPage = response.data.isLastPage;
            if (!isLastPage) {
                params.start = response.data.nextPageStart;
            }
        }
        console.log(`Finished fetching and saving commits for  ${repositorySlug} Total rows fetched from API: ${totalRowsFromAPI}. Total rows saved to database: ${totalRowsSaved}`);
    } catch (error) {
        console.error(`Error fetching and saving commits for repository ${repositorySlug}: ${error}`);
        throw error;
    }
}

// async function fetchAndSaveCommits(repoId, repositorySlug, projectKey, projectId) {
//     try {
//         let isLastPage = false;
//         let start = 0;
//         const limit = 5; // Consider the Bitbucket API's rate limiting
    
//        let params = { start, limit };
//         let totalRowsFromAPI = 0; // Counter for rows returned from API
//         let totalRowsSaved = 0; // Counter for rows saved to database
//         console.log(`Feching  ${repoId} - ${repositorySlug} in project ${projectKey} in projectID  ${projectId}`);

//         while (!isLastPage) {
//             console.log(`Getting data from ${repositorySlug} in project ${projectKey}`);
//             console.log(`Params`,params);
//             const response = await bitbucketClient.get(`projects/${projectKey}/repos/${repositorySlug}/commits`, { params });
//             console.log("response", JSON.stringify({size:response.data.size,isLastPage:response.data.isLastPage,start:response.data.start,nextPageStart:response.data.nextPageStart},"",4))
//             if (response.data.values && response.data.values.length > 0) {
//                 totalRowsFromAPI += response.data.values.length; // Update counter for API rows

//                 console.log(`Fetched ${response.data.values.length} rows from API for ${repositorySlug} in project ${projectKey}. Total so far: ${totalRowsFromAPI}`);
//                 // Prepare data for insertion in chunks to avoid exceeding placeholder limits
//                 const chunkSize = 500; // Adjust based on your table schema to avoid hitting the placeholder limit
//                 for (let i = 0; i < response.data.values.length; i += chunkSize) {
//                     const chunk = response.data.values.slice(i, i + chunkSize);
//                     const values = chunk.map(commit => {
//                         const { id, author, authorTimestamp, committer, committerTimestamp, message, properties } = commit;
//                         const jiraKey = properties && properties['jira-key'] ? properties['jira-key'][0] : null;
//                         return [
//                             id, repositorySlug, repoId, projectKey, projectId, author.name, author.emailAddress,
//                             committer.name, committer.emailAddress, committerTimestamp, authorTimestamp, message, jiraKey
//                         ];
//                     }).flat();

//                     const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?,?,FROM_UNIXTIME(? / 1000),FROM_UNIXTIME(? / 1000),?,?)').join(',');
//                     const query = `
//                         INSERT INTO commits (commit_id, repository_slug, repository_id, project_key, project_id, author_name, author_email, committer_name, committer_email, committer_timestamp, author_timestamp, message, jira_key)
//                         VALUES ${placeholders}`;
                        
//                     // if (i === 0) {
//                     //     console.log("First batch of placeholder data:", values.slice(0, 13)); // Assuming 13 placeholders per commit
//                     // }
                    
//                     try {
//       const result = await db.query(query, values);
//                         totalRowsSaved += chunk.length; // Update counter for saved rows

//                         console.log(`Batch ${Math.ceil((i + chunkSize) / chunkSize)}: Saved ${chunk.length} commits. Total saved so far: ${totalRowsSaved} -Afected ${result} `);
//                     } catch (error) {
//                         if (error.code === 'ER_DUP_ENTRY') {
//                             // Log the duplicate entry error
//                             console.error(`Duplicate entry for batch ${Math.ceil((i + chunkSize) / chunkSize)}: ${error}`);
//                         } else {
//                             // Handle other errors as before
//                             console.error(`Error saving commits for batch ${Math.ceil((i + chunkSize) / chunkSize)}: ${error}`);
//                         }
//                     }
//                 }
                
//             } else {
//                 console.log(`No values found for ${repositorySlug} in project ${projectKey}`);
//             }

//             isLastPage = response.data.isLastPage;
//             if (!isLastPage) {
//                 params.start = response.data.nextPageStart;
//             }
//         }
//         console.log(`Finished fetching and saving commits. Total rows fetched from API: ${totalRowsFromAPI}. Total rows saved to database: ${totalRowsSaved}`);

//     } catch (error) {
//         console.error(`Error fetching and saving commits for repository ${repositorySlug}: ${error}`);
//         throw error;
//     }
// }

async function CommitSync() {
    try {
        const repositories = await db.query("SELECT id, slug, project_key, project_id FROM repositories");
        const chunkSize = 6;
        for (let i = 0; i < repositories.length; i += chunkSize) {
            const repositoryChunk = repositories.slice(i, i + chunkSize);
            const promises = repositoryChunk.map(({ id, slug, project_key, project_id }) =>
                fetchAndSaveCommits(id, slug, project_key, project_id)
            );

            await Promise.all(promises)
                .then(() => console.log(`Completed syncing ${i + promises.length} of ${repositories.length} repositories.`))
                .catch(error => console.error(`Error in commit sync chunk: ${error}`));
        }
    } catch (error) {
        console.error(`Error in CommitSync: ${error}`);
        throw error;
    }
}

module.exports = { CommitSync };
