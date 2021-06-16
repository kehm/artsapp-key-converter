import axios from 'axios';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
    mapCharacters, mapKeyMedia, mapMediaElements,
    mapStatements, mapTaxa,
} from '../utils/map.js';
import isValid from '../utils/validate.js';

/**
 * Convert key from the old ArtsApp format to the new JSON schema
 *
 * @param {Object} key Old format key
 * @param {string} language Key language
 */
const convertToSchema = (key, language) => new Promise((resolve, reject) => {
    const schema = JSON.parse(fs.readFileSync(process.env.SCHEMA_PATH, 'utf-8'));
    const keyJson = {};
    keyJson.$schema = schema.$schema;
    keyJson.identifier = uuidv4();
    keyJson.title = { [language]: key.name };
    keyJson.description = { [language]: key.keyInfo };
    keyJson.language = [language];
    keyJson.license = process.env.DEFAULT_LICENSE;
    keyJson.creator = process.env.DEFAULT_CREATOR;
    let date = new Date().toISOString();
    date = date.replace('T', ' ');
    [date] = date.split('.');
    keyJson.created = date;
    keyJson.version = key.version;
    keyJson.status = key.keyStatus.toUpperCase();
    keyJson.lastModified = date;
    keyJson.mediaElements = mapMediaElements(key.image);
    const keyMediaElements = mapKeyMedia([key.keyImage, key.keyImageInfo]);
    keyMediaElements.forEach((element) => keyJson.mediaElements.unshift(element));
    keyJson.media = keyMediaElements.map((element) => element.id);
    keyJson.characters = mapCharacters(key.trait, key.value, key.image, language);
    keyJson.taxa = mapTaxa(key.species, key.image, language);
    keyJson.statements = mapStatements(key.value, key.spHasValue);
    fs.writeFile(`${process.env.TARGET_PATH}/${key.keyWeb}-old.json`.toLowerCase(), JSON.stringify(key), 'utf8', (err) => {
        if (err) console.log(err);
    });
    if (isValid(schema, keyJson)) {
        fs.writeFile(`${process.env.TARGET_PATH}/${key.keyWeb}-new.json`.toLowerCase(), JSON.stringify(keyJson), 'utf8', (err) => {
            if (err) {
                reject(err);
            } else {
                console.log(`Successfully converted ${key.keyWeb} (path: ${process.env.TARGET_PATH}/${key.keyWeb}-new.json)`);
                resolve();
            }
        });
    } else {
        console.error('Conversion failed');
        reject();
    }
});

/**
 * Get key from old API and convert to new JSON format
 *
 * @param {Object} key Key from old API
 */
const convertKey = async (key) => {
    const response = await axios.get(`https://artsapp.uib.no/api/v1/keys/get/${key.keyWeb}`);
    console.log(`Converting ${key.keyWeb}...`);
    await convertToSchema(response.data, key.language);
};

export default convertKey;
