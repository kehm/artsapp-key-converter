import fs from 'fs';
import Key from '../lib/database/models/Key.js';
import KeyInfo from '../lib/database/models/KeyInfo.js';
import Languages from '../lib/database/models/Languages.js';
import Revision from '../lib/database/models/Revision.js';
import Revisions from '../lib/database/models/Revisions.js';
import isValid from '../utils/validate.js';
import Taxon from '../lib/database/models/Taxon.js';
import Character from '../lib/database/models/Character.js';
import CharacterState from '../lib/database/models/CharacterState.js';
import createMedia from '../utils/media.js';

/**
 * Create entities, give new IDs and categorize media on entity
 *
 * @param {string} keyId Key ID
 * @param {Array} taxa Taxa array
 * @param {Array} characters Characters array
 * @param {Array} statements Statements array
 * @param {Array} mediaElements Media elements array
 * @param {Array} mediaKey Key media array
 * @returns {Object} Media arrays for entities
 */
const createEntities = (
    keyId, taxa, characters, statements, mediaElements, mediaKey,
) => new Promise((resolve, reject) => {
    const revisionMedia = [];
    const keyMedia = [];
    const promises = [];
    const taxaMedia = [];
    const stateMedia = [];
    const stateArr = [];
    mediaElements.forEach((element) => {
        if (mediaKey.includes(element.id)) {
            keyMedia.push({ mediaId: element.id, id: keyId });
        }
    });
    // Set new taxa IDs and media
    taxa.forEach((taxon) => {
        promises.push(new Promise((resolve, reject) => {
            Taxon.create({ keyId }).then((dbTaxon) => {
                statements.forEach((statement) => {
                    if (statement.taxonId === taxon.id) statement.taxonId = `${dbTaxon.id}`;
                });
                taxon.id = `${dbTaxon.id}`;
                if (taxon.media) {
                    if (Array.isArray(taxon.media)) {
                        taxon.media.forEach((media) => {
                            taxaMedia.push({ mediaId: `${media}`, id: `${dbTaxon.id}` });
                            revisionMedia.push({ id: `${media}` });
                        });
                    } else {
                        taxaMedia.push({ mediaId: `${taxon.media}`, id: `${dbTaxon.id}` });
                        revisionMedia.push({ id: `${taxon.media}` });
                        taxon.media = [`${taxon.media}`];
                    }
                }
                resolve();
            }).catch((err) => reject(err));
        }));
    });
    // Set new character and state IDs and media
    characters.forEach((character) => {
        promises.push(new Promise((resolve, reject) => {
            Character.create({ keyId, type: 'EXCLUSIVE' }).then((dbCharacter) => {
                statements.forEach((statement) => {
                    if (statement.characterId === character.id) statement.characterId = `${dbCharacter.id}`;
                });
                character.id = `${dbCharacter.id}`;
                if (character.states) {
                    const innerPromises = [];
                    character.states.forEach((state) => {
                        innerPromises.push(new Promise((resolve, reject) => {
                            CharacterState.create({
                                characterId: dbCharacter.id,
                            }).then((dbState) => {
                                statements.forEach((statement) => {
                                    if (statement.value === state.id) statement.value = `${dbState.id}`;
                                });
                                state.id = `${dbState.id}`;
                                stateArr.push(state);
                                if (state.media) {
                                    stateMedia.push({ mediaId: `${state.media}`, id: `${dbState.id}`, characterId: character.id });
                                    revisionMedia.push({ id: `${state.media}` });
                                }
                                resolve();
                            }).catch((err) => reject(err));
                        }));
                    });
                    Promise.all(innerPromises).then(() => {
                        resolve();
                    }).catch((err) => reject(err));
                }
            }).catch((err) => reject(err));
        }));
    });
    Promise.all(promises).then(() => {
        resolve({
            keyMedia,
            taxaMedia,
            stateMedia,
            revisionMedia,
            stateArr,
        });
    }).catch((err) => reject(err));
});

/**
 * Get sub taxa
 *
 * @param {Array} arr Taxa array
 * @param {Array} taxa New taxa array
 */
const getTaxa = (arr, taxa) => {
    arr.forEach((taxon) => {
        taxa.push(taxon);
        if (taxon.children) getTaxa(taxon.children, taxa);
    });
};

/**
 * Insert keys in JSON format to the database
 *
 * @param {string} keyName Key name
 */
const insertIntoDatabase = async (keyName) => {
    console.log(`Inserting ${keyName}...`);
    const schema = JSON.parse(fs.readFileSync(process.env.SCHEMA_PATH, 'utf-8'));
    if (fs.existsSync(`${process.env.TARGET_PATH}/${keyName}-new.json`)) {
        const keyJson = JSON.parse(fs.readFileSync(`${process.env.TARGET_PATH}/${keyName}-new.json`, 'utf-8'));
        if (isValid(schema, keyJson)) {
            const revision = await Revision.create({
                content: {},
                media: {},
                note: 'Imported from old ArtsApp',
                createdBy: process.env.CREATED_BY,
                status: 'ACCEPTED',
            });
            const key = await Key.create({
                revisionId: revision.id,
                workgroupId: 1,
                createdBy: process.env.CREATED_BY,
                status: 'PRIVATE',
                version: keyJson.version,
            });
            await Revisions.create({
                keyId: key.id,
                revisionId: revision.id,
            });
            const taxa = [];
            getTaxa(keyJson.taxa, taxa);
            const entityMedia = await createEntities(
                key.id,
                taxa,
                keyJson.characters,
                keyJson.statements,
                keyJson.mediaElements,
                keyJson.media,
            );
            const promises = [];
            const {
                keyMedia,
                taxaMedia,
                stateMedia,
                revisionMedia,
                stateArr,
            } = entityMedia;
            promises.push(createMedia(
                key.id,
                'keys',
                keyMedia,
                keyJson.mediaElements,
                revisionMedia,
            ));
            promises.push(createMedia(
                key.id,
                'taxa',
                taxaMedia,
                keyJson.mediaElements,
                revisionMedia,
                taxa,
            ));
            promises.push(createMedia(
                key.id,
                'states',
                stateMedia,
                keyJson.mediaElements,
                revisionMedia,
                stateArr,
            ));
            promises.push(KeyInfo.create({
                keyId: key.id,
                languageCode: keyJson.language[0],
                title: keyJson.title[keyJson.language[0]],
                description: keyJson.description[keyJson.language[0]],
            }));
            promises.push(Languages.create({
                keyId: key.id,
                languageCode: keyJson.language[0],
            }));
            await Promise.all(promises);
            const content = {
                taxa: keyJson.taxa,
                characters: keyJson.characters,
                statements: keyJson.statements,
            };
            await revision.update({
                content,
                media: { mediaElements: revisionMedia },
            });
            console.log(`Successfully inserted key into database (key ID: ${key.id})`);
        } else throw new Error('Key JSON is not valid');
    } else throw new Error('Could not find JSON file for key');
};

export default insertIntoDatabase;
