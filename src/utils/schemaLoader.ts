import Ajv from 'ajv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';

const ajv = new Ajv({ allErrors: true });

function loadSchema(filePath: string) {
  const schema = JSON.parse(readFileSync(filePath, 'utf-8'));
  const baseDir = dirname(filePath);

  if (schema.$schema) {
    const schemaPath = resolve(baseDir, schema.$schema);
    const referencedSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    ajv.addSchema(referencedSchema, schema.$schema);
  }

  return schema;
}

export function compileSchema(filePath: string) {
  const schema = loadSchema(filePath);
  return ajv.compile(schema);
}
