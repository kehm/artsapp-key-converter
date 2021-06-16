import Ajv from 'ajv';

/**
 * Run JSON schema validation
 *
 * @param {Object} schema JSON schema
 * @param {Object} data JSON data
 * @returns {boolean} True if valid
 */
const isValid = (schema, data) => {
    const ajv = new Ajv.default();
    const validate = ajv.compile(schema);
    if (validate(data)) return true;
    console.log(validate.errors);
    return false;
};

export default isValid;
