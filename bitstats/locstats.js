const db = require('./database');
const bitbucketClient = require('./bitConnection');

async function fetchDiffForCommit(commitId, repositorySlug, projectKey) {
    try {
        const response = await bitbucketClient.get(
            `/projects/${projectKey}/repos/${repositorySlug}/commits/${commitId}/diff`
        );
        return response.data;
    } catch (error) {
        console.error(`Error fetching diff for commit ${commitId}: ${error}`);
        throw error;
    }
}

function parseDiffAndCountLOC(diffResponse) {
    let linesAdded = 0;
    let linesRemoved = 0;
    if (diffResponse && diffResponse.diffs && Array.isArray(diffResponse.diffs)) {
        diffResponse.diffs.forEach((diff) => {
            if (diff.hunks && Array.isArray(diff.hunks)) {
                diff.hunks.forEach((hunk) => {
                    if (hunk.segments && Array.isArray(hunk.segments)) {
                        hunk.segments.forEach((segment) => {
                            if (segment.type === "ADDED") {
                                linesAdded += segment.lines.length;
                            } else if (segment.type === "REMOVED") {
                                linesRemoved += segment.lines.length;
                            }
                        });
                    }
                });
            }
        });
    }
    return { linesAdded, linesRemoved };
}

async function updateLOCStatsForCommit(commitId, locStats, repositoryId, projectId, commitDate) {
    const { linesAdded, linesRemoved } = locStats;
    try {
        await db.query(`
            INSERT INTO loc_stats (commit_id, repository_id, project_id, lines_added, lines_removed, commited_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                lines_added = VALUES(lines_added),
                lines_removed = VALUES(lines_removed),
                commited_at = VALUES(commited_at)
        `, [commitId, repositoryId, projectId, linesAdded, linesRemoved, commitDate]);
    } catch (error) {
        console.error(`Error updating LOC stats for commit ${commitId}: ${error}`);
        throw error;
    }
}

async function getLastProcessedCommitTimestamp (repositoryId) {
    const [result] = await db.query('SELECT commited_at FROM loc_stats WHERE repository_id = ? ORDER BY commited_at ASC LIMIT 1 ', [repositoryId]);
    return result ? result.commited_at: null;
}


async function fetchCommitsFromDB(repositoryId, commited_at) {
    let query = 'SELECT commit_id, committer_timestamp FROM commits WHERE repository_id = ? ';
    let queryParams = [repositoryId];
    if (commited_at) {
        query += 'AND committer_timestamp < ? ';
        queryParams.push(commited_at);
    }
    query += 'ORDER BY committer_timestamp DESC';
    const commits = await db.query(query, queryParams);
   
    return commits;
}

async function updateLOCStats(repositoryId, slug, projectKey, projectId) {
    const lastProcessedCommitTimestamp = await  getLastProcessedCommitTimestamp(repositoryId);
    const commits = await fetchCommitsFromDB(repositoryId, lastProcessedCommitTimestamp);

    const processCommitsInChunks = async (commits, chunkSize) => {
        for (let i = 0; i < commits.length; i += chunkSize) {
            const commitChunk = commits.slice(i, i + chunkSize);
            await Promise.all(commitChunk.map(async (commit) => {
                const diff = await fetchDiffForCommit(commit.commit_id, slug, projectKey);
                const locStats = parseDiffAndCountLOC(diff);
                await updateLOCStatsForCommit(commit.commit_id, locStats, repositoryId, projectId, commit.committer_timestamp);
            }));
            console.log(i + " Chunk of "+ commits.length + " were done for " +slug)
        }
    };

    await processCommitsInChunks(commits, 50);

    // if (commits.length > 0) {
    //     await setLastProcessedCommitId(repositoryId, commits[commits.length - 1].id);
    // }
}

async function syncAllRepositories() {
    const repositories = await db.query('SELECT id, slug, project_key, project_id FROM repositories');
    for (const repo of repositories) {
        await updateLOCStats(repo.id, repo.slug, repo.project_key, repo.project_id);
        console.log(`Lines of code for ${repo.slug} updated`);
    }
}

module.exports = { syncAllRepositories };
