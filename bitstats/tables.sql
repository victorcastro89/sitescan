CREATE DATABASE dev_metrics;
USE dev_metrics;

CREATE TABLE IF NOT EXISTS commits (
    id VARCHAR(255) PRIMARY KEY,
    repository_id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    author_name VARCHAR(255) NOT NULL,
    author_email VARCHAR(255) NOT NULL,
    committer_name VARCHAR(255) NOT NULL,
    committer_email VARCHAR(255) NOT NULL,
    committer_timestamp TIMESTAMP NOT NULL,
    author_timestamp TIMESTAMP NOT NULL,
    message TEXT NOT NULL,
    jira_key VARCHAR(255),
    FOREIGN KEY (repository_id) REFERENCES repositories(repository_id),
    FOREIGN KEY (project_id) REFERENCES projects(project_id),
    INDEX jira_key_idx (jira_key),
    INDEX author_email_idx (author_email),
    INDEX committer_email_idx (committer_email),
      INDEX author_timestamp_idx (author_timestamp),
        INDEX committer_timestamp_idx (committer_timestamp)
);

CREATE TABLE IF NOT EXISTS projects (
    id INT PRIMARY KEY,
    key VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    UNIQUE(key)
);

CREATE TABLE IF NOT EXISTS repositories (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    project_id INT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(slug)
);
