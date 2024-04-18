const fs = require('fs');
const path = require('path');

/**
 * Reads a JSON file and returns its content as an object.
 * @param {string} filePath Path to the JSON file.
 * @returns {Object}
 */
const readJSON = (filePath) => {
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
    const groups = readJSON(filePath);
    const groupEntries = Object.entries(groups).map(([id, { name }]) => ({
        id: id,
        name: name
    }));
    await knex('groups').insert(groupEntries);

    filePath = path.join(__dirname, '../wappalyzer/src/drivers/npm/', 'categories.json');
    const categories = readJSON(filePath);
    const categoryEntries = Object.entries(categories).map(([id, { name }]) => ({
        id: id,
        name: name
    }));
    await knex('categories').insert(categoryEntries);

    // Load technologies from multiple files in the technologies folder
    const techDir = path.join(__dirname, '../wappalyzer/src/drivers/npm/', 'technologies');
    const files = fs.readdirSync(techDir);
    for (let file of files) {
        if (file.endsWith('.json')) {
            const techData = readJSON(path.join(techDir, file));
            for (let [name, tech] of Object.entries(techData)) {
                const technologyEntries = {
                    name: name,
                    description: tech.description,
                    price: tech.pricing ? tech.pricing.join(', ') : null,
                    saas: tech.hasOwnProperty('saas') ? tech.saas : null
                };
                const [insertedId] = await knex('technologies').insert(technologyEntries).returning('id');

                const techCategoryEntries = tech.cats.map(catId => ({
                    technology_id: insertedId.id,
                    category_id: catId.toString()
                }));

                await knex('technology_categories').insert(techCategoryEntries);
            }
        }
    }

    // Insert group-category relationships
    const groupCategoryEntries = [];
    for (let [catId, category] of Object.entries(categories)) {
        if (category.groups) {
            category.groups.forEach(groupId => {
                groupCategoryEntries.push({
                    group_id: groupId.toString(),
                    category_id: catId
                });
            });
        }
    }
    await knex('group_categories').insert(groupCategoryEntries);
};
