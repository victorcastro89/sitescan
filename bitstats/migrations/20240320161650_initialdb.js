exports.up = function(knex) {
    // Create all tables sequentially using Knex's schema building syntax
    return knex.schema
      .raw('CREATE DATABASE IF NOT EXISTS dev_metrics') // Knex does not directly support database creation. This might need to be handled outside of migrations or with raw SQL.
      .then(() => knex.raw('USE dev_metrics')) // Same as above
      .then(function() {
   
        return knex.schema
      .createTable('projects', function(table) {
        table.increments('id').primary();
        table.string('project_key').notNullable().unique();
        table.string('name').notNullable();
      })
    })
    .then(function() {
        return knex.schema
      .createTable('repositories', function(table) {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('slug').notNullable().unique();
        table.integer('project_id').unsigned();
        table.string('project_key').notNullable();
        table.timestamp('last_processed_commit');
        table.foreign('project_id').references('projects.id').onDelete('CASCADE');
      })      })
      .then(function() {
        return knex.schema
      .createTable('repo_sync_state', function(table) {
        table.integer('repository_id').unsigned().primary();
        table.string('last_processed_commit_id');
        table.foreign('repository_id').references('repositories.id');
      })
    })

.then(function() {
    return knex.schema
      .createTable('commits', function(table) {
        table.increments('id').primary();
        table.string('commit_id').notNullable();
        table.integer('repository_id').unsigned().notNullable();
        table.string('repository_slug').notNullable();
        table.integer('project_id').unsigned().notNullable();
        table.string('project_key').notNullable();
        table.string('author_name').notNullable();
        table.string('author_email').notNullable();
        table.string('committer_name').notNullable();
        table.string('committer_email').notNullable();
        table.timestamp('committer_timestamp');
        table.timestamp('author_timestamp');
        table.text('message').notNullable();
        table.string('jira_key');
        table.foreign('repository_id').references('repositories.id');
        table.foreign('project_id').references('projects.id');
        table.index('jira_key', 'jira_key_idx');
        table.index('author_email', 'author_email_idx');
        table.index('committer_email', 'committer_email_idx');
        table.index('author_timestamp', 'author_timestamp_idx');
        table.index('committer_timestamp', 'committer_timestamp_idx');
        table.index('author_name', 'author_name_idx');
        table.index('committer_name', 'committer_name_idx');
      })   
    })
    .then(function() {
        return knex.schema
      .createTable('loc_stats', function(table) {
        table.increments('id').primary();
        table.string('commit_id').notNullable();
        table.integer('repository_id').unsigned().notNullable();
        table.integer('project_id').unsigned().notNullable();
        table.integer('lines_added').notNullable();
        table.integer('lines_removed').notNullable();
        table.specificType('net_lines', 'INT GENERATED ALWAYS AS (lines_added - lines_removed) STORED');
        table.timestamp('commited_at');
        table.foreign('repository_id').references('repositories.id');
        table.foreign('project_id').references('projects.id');
        table.index('commit_id', 'commit_id_loc_idx');
        table.index('commited_at', 'commited_at_timestamp_idx');
      });
    })
    
  };
  
  exports.down = function(knex) {
    // Drop tables in reverse order of creation due to foreign key constraints
    return knex.schema
      .dropTableIfExists('loc_stats')
      .dropTableIfExists('commits')
      .dropTableIfExists('repo_sync_state')
      .dropTableIfExists('repositories')
      .dropTableIfExists('projects');
    // Dropping the database is typically not included in migrations and might need to be handled separately.
  };
  