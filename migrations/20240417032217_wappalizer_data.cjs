/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return Promise.all([
        // Creating Technologies table
        knex.schema.createTable('technologies', function(table) {
            table.increments('id').primary();  // Unique ID
            table.string('name').notNullable();
            table.text('description');
            table.string('price');
            table.boolean('saas');
        }),

        // Creating Groups table
        knex.schema.createTable('groups', function(table) {
            table.string('id').primary();  // Unique ID (not auto-generated)
            table.string('name').notNullable();
        }),

        // Creating Categories table
        knex.schema.createTable('categories', function(table) {
            table.string('id').primary();  // Unique ID (not auto-generated)
            table.string('name').notNullable();
        }),

        // Creating TechnologyCategories junction table
        knex.schema.createTable('technology_categories', function(table) {
            table.integer('technology_id').unsigned();
            table.foreign('technology_id').references('technologies.id');
            table.string('category_id');
            table.foreign('category_id').references('categories.id');
            table.primary(['technology_id', 'category_id']);
        }),

        // Creating GroupCategories junction table
        knex.schema.createTable('group_categories', function(table) {
            table.string('group_id');
            table.foreign('group_id').references('groups.id');
            table.string('category_id');
            table.foreign('category_id').references('categories.id');
            table.primary(['group_id', 'category_id']);
        }),

        knex.schema.createTable('domain_technologies', function(table) {
            table.text('domain');
            table.foreign('domain').references('domain_status.domain');
            table.integer('technology_id').unsigned();
            table.foreign('technology_id').references('technologies.id');
            table.primary(['domain', 'technology_id']);
        })

    ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return Promise.all([
        knex.schema.dropTableIfExists('domain_technologies'),
        knex.schema.dropTableIfExists('group_categories'),
        knex.schema.dropTableIfExists('technology_categories'),
        knex.schema.dropTableIfExists('categories'),
        knex.schema.dropTableIfExists('groups'),
        knex.schema.dropTableIfExists('technologies')
    ]);
};
