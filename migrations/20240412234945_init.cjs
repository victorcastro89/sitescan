/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('domain_status', function(table) {
      table.text('domain').primary();
      table.text('ns1_record');
      table.text('ns2_record');
      table.text('mx1_record');
      table.text('mx2_record');
      table.text('dns_a_record');
      table.specificType('ripe_org', 'text[]');
      table.specificType('ripe_abuse', 'text[]');
      table.boolean('has_ssl');
      table.boolean('is_online');
      table.text('parsed_hosting_name');
      table.dateTime('created_at').defaultTo(knex.fn.now());
      table.dateTime('updated_at');
      
      // Adding indexes
      table.index('is_online', 'idx_is_online');  // Index for the is_online column
      table.index('parsed_hosting_name', 'idx_hosting_name');  // Index for the hosting_name column
      table.index('has_ssl', 'idx_has_ssl');  // Index for the has_ssl column
  });
};

/**
* @param { import("knex").Knex } knex
* @returns { Promise<void> }
*/
exports.down = function(knex) {
  return knex.schema.dropTable('domain_status');
};
