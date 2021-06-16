/**
 * Generate media ID
 *
 * @param {string} image Image url
 * @returns {string} Media ID
 */
const generateMediaId = (image) => {
    let id;
    if (image) {
        const paths = image.split('/');
        const fileName = paths[paths.length - 1];
        id = fileName.split('.')[0].toLowerCase().replace(/[ ,()!?_\-\u00C6\u00E6\u00D8\u00F8\u00C5\u00E5]/g, '');
    }
    return id;
};

/**
 * Extract images for key
 *
 * @param {Array} images Image array from old API
 * @returns {Array} Key media elements
 */
export const mapKeyMedia = (mediaUrls) => {
    const mediaElements = [];
    mediaUrls.forEach((element) => {
        if (element) {
            const localizedMediaElement = {
                id: generateMediaId(element),
                mediaElement: {
                    mediaFile: {
                        url: element,
                    },
                },
            };
            mediaElements.push(localizedMediaElement);
        }
    });
    return mediaElements;
};

/**
 * Convert image array (old) to mediaElements array (new)
 *
 * @param {Array} images Image array from old API
 * @returns {Array} Media elements
 */
export const mapMediaElements = (images) => {
    const mediaElements = [];
    if (images) {
        images.forEach((element) => {
            const localizedMediaElement = {
                id: generateMediaId(element.image),
                mediaElement: {
                    mediaFile: {
                        url: element.image,
                    },
                },
            };
            mediaElements.push(localizedMediaElement);
        });
    }
    return mediaElements;
};

/**
 * Convert trait and value arrays (old) to characters array (new)
 *
 * @param {Array} traits Traits array from old API
 * @param {Array} values Values array from old API
 * @param {Array} images State images
 * @param {string} language Key language
 * @returns {Array} Characters
 */
export const mapCharacters = (traits, values, images, language) => {
    const characters = [];
    traits.forEach((trait) => {
        const states = [];
        values.forEach((value) => {
            if (value.traitId === trait.traitId) {
                const image = images && images.find((img) => img.typeId === value.valueId);
                const alternative = {
                    id: `${value.valueId}`,
                    title: { [language]: `${value.valueText}` },
                    media: generateMediaId(image ? image.image : undefined),
                };
                states.push(alternative);
            }
        });
        const character = {
            id: `${trait.traitId}`,
            type: 'exclusive',
            title: { [language]: trait.traitText },
            states,
        };
        characters.push(character);
    });
    return characters;
};

/**
 * Convert species array (old) to taxa array (new)
 *
 * @param {Array} species Species array from old API
 * @param {Array} images Taxa images
 * @param {string} language Key language
 * @returns {Array} Taxa
 */
export const mapTaxa = (species, images, language) => {
    const taxa = [];
    const tmpTaxa = [];
    const tmpOrders = [];
    species.forEach((element) => {
        const image = images && images.find((img) => img.typeId === element.speciesId);
        const taxon = {
            id: `${element.speciesId}`,
            scientificName: element.latinName,
            vernacularName: { [language]: element.localName },
            media: generateMediaId(image ? image.image : undefined),
            order: element.order,
            family: element.family,
        };
        tmpTaxa.push(taxon);
        if (element.order) {
            tmpOrders.push(element.order);
        } else taxa.push(taxon);
    });
    const orders = [...new Set(tmpOrders)];
    orders.forEach((element) => {
        const tmpFamilies = [];
        tmpTaxa.forEach((taxon) => {
            if (taxon.order === element) tmpFamilies.push(taxon.family);
        });
        const familyNames = [...new Set(tmpFamilies)];
        const families = [];
        familyNames.forEach((family) => {
            if (family) {
                families.push({
                    id: family.toLowerCase(),
                    scientificName: family,
                    children: [],
                });
            }
        });
        families.forEach((family) => {
            tmpTaxa.forEach((taxon) => {
                if (taxon.family === family.scientificName) {
                    delete taxon.order;
                    delete taxon.family;
                    family.children.push(taxon);
                }
            });
        });
        taxa.push({
            id: `${element}`.toLowerCase(),
            scientificName: element,
            children: families,
        });
    });
    taxa.forEach((taxon) => {
        delete taxon.order;
        delete taxon.family;
    });
    return taxa;
};

/**
 * Convert spHasValue array (old) to statements array (new)
 *
 * @param {Array} values Values array from old API
 * @param {Array} speciesValues Species has values array from old API
 * @returns {Array} Statements
 */
export const mapStatements = (values, speciesValues) => {
    const statements = [];
    speciesValues.forEach((element) => {
        statements.push({
            id: `${element.spHasValueId}`,
            taxonId: `${element.spId}`,
            characterId: `${values.find((val) => val.valueId === element.valueId).traitId}`,
            value: `${element.valueId}`,
        });
    });
    return statements;
};
