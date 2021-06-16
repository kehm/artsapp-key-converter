import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import KeyMedia from '../lib/database/models/KeyMedia.js';
import Media from '../lib/database/models/Media.js';

/**
 * Write file to disk
 *
 * @param {Object} response Response stream
 * @param {Object} file File write stream
 */
const writeFile = (response, file) => new Promise((resolve, reject) => {
    response.data.pipe(file);
    let error = false;
    file.on('error', (err) => {
        file.close();
        error = true;
        reject(err);
    });
    file.on('close', () => {
        if (!error) resolve();
    });
});

/**
 * Resize image file
 *
 * @param {string} fileName File name
 * @param {string} type File type
 * @param {string} destination Destination path
 * @param {int} width Width in pixels
 * @param {int} height Height in pixels
 * @param {int} quality Quality
 * @param {string} newName New file ending (to distinguish from existing file)
 */
const resizeImage = (
    fileName, type, destination, width, height, quality, newName,
) => new Promise((resolve, reject) => {
    const name = fileName.split('.')[0];
    Media.findOne({ where: { fileName } }).then((media) => {
        if (media) {
            switch (type) {
                case 'image/jpeg':
                    sharp(`${destination}/${fileName}`)
                        .resize(width, height)
                        .jpeg({ quality })
                        .toFile(path.resolve(destination, `${name}-${newName}.jpeg`))
                        .then(() => { resolve(); })
                        .catch((err) => reject(err));
                    break;
                case 'image/png':
                    sharp(`${destination}/${fileName}`)
                        .resize(width, height)
                        .png({ quality })
                        .toFile(path.resolve(destination, `${name}-${newName}.png`))
                        .then(() => { resolve(); })
                        .catch((err) => reject(err));
                    break;
                default:
                    reject();
                    break;
            }
        } else reject();
    }).catch((err) => reject(err));
});

/**
 * Create image file and thumbnail
 *
 * @param {Object} response Stream response
 * @param {Object} file File write stream
 * @param {string} fileName File name
 * @param {string} type File type
 * @param {string} destination File destination
 */
const createFile = async (response, file, fileName, type, destination) => {
    await writeFile(response, file);
    file.close();
    await resizeImage(fileName, type, destination, 128, 128, 90, 'thumbnail');
};

/**
 * Fetch file from API and write to disk
 *
 * @param {string} url API URL
 * @param {string} fileName File nmae
 * @param {string} destination File destination
 * @param {string} type File type
 */
const fetchFile = (url, fileName, destination, type) => new Promise((resolve, reject) => {
    try {
        if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
        const file = fs.createWriteStream(`${destination}/${fileName}`);
        axios.get(url, { responseType: 'stream' }).then((response) => {
            createFile(response, file, fileName, type, destination).then(() => {
                resolve();
            }).catch((err) => reject(err));
        }).catch(() => {
            // Re-try once
            axios.get(url, { responseType: 'stream' }).then((response) => {
                createFile(response, file, fileName, type, destination).then(() => {
                    resolve();
                }).catch((err) => reject(err));
            }).catch(() => {
                console.log(`Could not get media: ${url}`);
                Media.destroy({ where: { fileName } }).then(() => {
                    file.destroy();
                    if (fs.existsSync(`${destination}/${fileName}`)) {
                        fs.unlink(`${destination}/${fileName}`, (err) => {
                            if (err) {
                                reject();
                            } else resolve();
                        });
                    } else resolve();
                }).catch((err) => reject(err));
            });
        });
    } catch (err) {
        resolve(err);
    }
});

/**
 * Get file extension and type
 *
 * @param {string} url File url
 * @returns {Object} File extension and type
 */
const getExtAndType = (url) => {
    let ext;
    let type;
    const splits = url.split('.');
    if (splits && splits.length > 0 && splits[splits.length - 1] === 'png') {
        type = 'image/png';
        ext = 'png';
    } else {
        type = 'image/jpeg';
        ext = 'jpeg';
    }
    return { ext, type };
};

/**
 * Get file destination
 *
 * @param {string} entityName Entity name
 * @param {Object} entity Entity object
 * @param {string} keyId Key ID
 * @returns {string} File destination
 */
const getDestination = (entityName, entity, keyId) => {
    let destination;
    if (entityName === 'keys') {
        destination = `${process.env.MEDIA_PATH}/keys/${keyId}`;
    } else if (entityName === 'states') {
        destination = `${process.env.MEDIA_PATH}/keys/${keyId}/characters/${entity.characterId}/${entityName}/${entity.id}`;
    } else destination = `${process.env.MEDIA_PATH}/keys/${keyId}/${entityName}/${entity.id}`;
    return destination;
};

/**
 * Create media for element
 *
 * @param {string} keyId Key ID
 * @param {string} entityName Entity name
 * @param {Array} revisionMedia Revision media
 * @param {Array} arr Entity array
 * @param {Object} entity Entity object
 * @param {Object} element Revision element
 */
const createMediaForElement = async (keyId, entityName, revisionMedia, arr, entity, element) => {
    const { ext, type } = getExtAndType(element.mediaElement.mediaFile.url);
    const destination = getDestination(entityName, entity, keyId);
    const media = await Media.create({
        type,
        createdBy: process.env.CREATED_BY,
    });
    const fileName = `${media.id}.${media.type.split('/')[1]}`.split('.')[0];
    const filePath = `${destination}/${fileName}.${ext}`;
    await media.update({
        fileName: `${fileName}.${ext}`,
        filePath,
        thumbnailName: `${fileName}-thumbnail.${ext}`,
        thumbnailPath: `${destination}/${fileName}-thumbnail.${ext}`,
    });
    await fetchFile(element.mediaElement.mediaFile.url, `${fileName}.${ext}`, destination, type);
    const revMedia = revisionMedia.find((rev) => rev.id === element.id);
    if (revMedia) revMedia.id = `${media.id}`;
    if (entityName === 'keys') {
        await KeyMedia.create({ keyId, mediaId: media.id });
    } else if (arr) {
        const ent = arr.find((entElement) => entElement.id === entity.id);
        if (ent) ent.media = [`${media.id}`];
    } else throw new Error();
};

/**
 * Create media in database
 *
 * @param {string} keyId Key ID
 * @param {string} entityName Entity name
 * @param {Array} entityMedia Media IDs for entity
 * @param {Array} mediaElements Media elements
 * @param {Array} revisionMedia Revision media
 * @param {Array} arr Entity array
 */
const createMedia = async (keyId, entityName, entityMedia, mediaElements, revisionMedia, arr) => {
    const promises = [];
    entityMedia.forEach((entity) => {
        const element = mediaElements.find((mediaElement) => mediaElement.id === entity.mediaId);
        promises.push(createMediaForElement(
            keyId,
            entityName,
            revisionMedia,
            arr,
            entity,
            element,
        ));
    });
    await Promise.all(promises);
};

export default createMedia;
