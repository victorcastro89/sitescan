const fs = require('fs');
const path = require('path');


    /**
     * Reads a JSON file and returns its content as an object.
     * @param {string} filePath Path to the JSON file.
     * @returns {Object}
     */
    const readJSON = (filePath) => {
        //console.log(filePath);
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    };
    
    /**
     * Seeds data from JSON files.
     * @param { import("knex").Knex } knex
     * @returns { Promise<void> }
     */
    exports.seed = async function(knex) {
      // Deletes ALL existing entries
      await knex('group_categories').del();
      await knex('technology_categories').del();
      await knex('categories').del();
      await knex('groups').del();
      await knex('technologies').del();
      let filePath = path.join(__dirname, '../wappalyzer/src/', 'groups.json');
      // Load group data
      const groups = readJSON(filePath);
      const groupEntries = Object.entries(groups).map(([id, { name }]) => ({
        id: id,
        name: name
      }));
      await knex('groups').insert(groupEntries);

      filePath = path.join(__dirname, '../wappalyzer/src/drivers/npm/', 'categories.json');
      // Load category data
      const categories = readJSON(filePath);
      const categoryEntries = Object.entries(categories).map(([id, { name }]) => ({
        id: id,
        name: name
      }));
      await knex('categories').insert(categoryEntries);


      // Load technologies from multiple files in the technologies folder
      const techDir = path.join(__dirname, '../wappalyzer/src/drivers/npm/', 'technologies');
      fs.readdirSync(techDir).forEach(async file => {
        if(file.split(".")[1] ==='json') {
        const techData = readJSON(path.join(techDir, file));
        const technologyEntries = Object.entries(techData).map(([name, tech]) => ({
          name: name,
          description: tech.description,
          price: tech.pricing ? tech.pricing.join(', ') : null,
          saas: tech.hasOwnProperty('saas') ? tech.saas : null
        }));
  
        // Insert technologies and retrieve their IDs
        const insertedIds = await knex('technologies').insert(technologyEntries).returning('id');
    
        // Map tech categories to the newly inserted tech IDs for the junction table
        insertedIds.forEach((techId, index) => {
          const tech = Object.values(techData)[index];
          const techCategoryEntries = tech.cats.map(catId => ({
            technology_id: techId,
            category_id: catId.toString()
          }));
          knex('technology_categories').insert(techCategoryEntries);
        });
      }  });
    
  // Insert group-category relationships
  const groupCategoryEntries = [];
  Object.entries(categories).forEach(([catId, { groups }]) => {
    groups.forEach(groupId => {
      groupCategoryEntries.push({
        group_id: groupId.toString(),
        category_id: catId
      });
    });
  });
  await knex('group_categories').insert(groupCategoryEntries);
};