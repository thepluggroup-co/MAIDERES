const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const ROOT = path.resolve(__dirname, '..')
const doc = yaml.load(fs.readFileSync(path.join(ROOT, 'docs/api/openapi.yaml'), 'utf8'))

function resolveRef(ref) {
  const parts = ref.replace(/^#\//, '').split('/')
  let cur = doc
  for (const p of parts) cur = cur && cur[p]
  return cur
}

function exampleFromSchema(schema, depth = 0) {
  if (!schema || depth > 4) return null
  if (schema['$ref']) return exampleFromSchema(resolveRef(schema['$ref']), depth + 1)
  if (schema.allOf) {
    let merged = {}
    for (const s of schema.allOf) Object.assign(merged, exampleFromSchema(s, depth + 1) || {})
    return merged
  }
  if (schema.type === 'object' || schema.properties) {
    const out = {}
    const required = new Set(schema.required || [])
    for (const [key, propSchema] of Object.entries(schema.properties || {})) {
      if (required.size > 0 && !required.has(key)) continue
      out[key] = exampleFromSchema(propSchema, depth + 1)
    }
    return out
  }
  if (schema.type === 'array') return [exampleFromSchema(schema.items, depth + 1)]
  if (schema.enum) return schema.enum[0]
  if (schema.format === 'uuid') return '00000000-0000-0000-0000-000000000000'
  if (schema.format === 'email') return 'user@example.com'
  if (schema.format === 'date-time') return '2026-01-01T00:00:00.000Z'
  if (schema.type === 'string') return ''
  if (schema.type === 'integer' || schema.type === 'number') return 0
  if (schema.type === 'boolean') return true
  return null
}

function resolveRequestBody(rb) {
  if (!rb) return null
  const body = rb['$ref'] ? resolveRef(rb['$ref']) : rb
  const schema = body?.content?.['application/json']?.schema
  if (!schema) return null
  return exampleFromSchema(schema)
}

function paramsToQuery(params) {
  return (params || [])
    .filter((p) => (p['$ref'] ? resolveRef(p['$ref']) : p).in === 'query')
    .map((p) => {
      const rp = p['$ref'] ? resolveRef(p['$ref']) : p
      return { key: rp.name, value: '', description: rp.schema?.type || '', disabled: !rp.required }
    })
}

function pathToPostmanPath(p) {
  return p.replace(/^\//, '').split('/').map((seg) =>
    seg.startsWith('{') && seg.endsWith('}') ? ':' + seg.slice(1, -1) : seg,
  )
}

const tagFolders = new Map()
for (const tag of doc.tags) tagFolders.set(tag.name, { name: tag.name, description: tag.description || '', item: [] })

for (const [routePath, methods] of Object.entries(doc.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    if (!['get', 'post', 'patch', 'put', 'delete'].includes(method)) continue
    const tag = (op.tags && op.tags[0]) || 'Other'
    if (!tagFolders.has(tag)) tagFolders.set(tag, { name: tag, item: [] })
    const segments = pathToPostmanPath(routePath)
    const body = resolveRequestBody(op.requestBody)
    const query = paramsToQuery(op.parameters)
    const isPublic = Array.isArray(op.security) && op.security.length === 0
    const req = {
      name: `${method.toUpperCase()} ${routePath}`,
      request: {
        method: method.toUpperCase(),
        header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
        auth: isPublic ? { type: 'noauth' } : undefined,
        url: {
          raw: '{{base_url}}' + routePath + (query.length ? '?' + query.map((q) => `${q.key}=`).join('&') : ''),
          host: ['{{base_url}}'],
          path: segments,
          query: query.length ? query : undefined,
        },
        description: op.summary || '',
      },
      response: [],
    }
    if (body) {
      req.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } }
    }
    tagFolders.get(tag).item.push(req)
  }
}

const collection = {
  info: {
    name: 'MAIDERES API',
    description: 'Généré depuis docs/api/openapi.yaml — ne pas éditer les requêtes à la main, régénérer via scripts/gen-postman.js si le spec change.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{access_token}}', type: 'string' }],
  },
  variable: [
    { key: 'base_url', value: 'http://localhost:3001/api/v1', type: 'string' },
    { key: 'access_token', value: '', type: 'string' },
  ],
  item: Array.from(tagFolders.values()).filter((f) => f.item.length > 0),
}

const outDir = path.join(ROOT, 'postman', 'collections')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'MAIDERES-API.postman_collection.json'), JSON.stringify(collection, null, 2))

const environment = {
  id: 'maideres-api-local',
  name: 'MAIDERES API — local',
  values: [
    { key: 'base_url', value: 'http://localhost:3001/api/v1', type: 'default', enabled: true },
    { key: 'access_token', value: '', type: 'secret', enabled: true },
  ],
  _postman_variable_scope: 'environment',
}
fs.writeFileSync(path.join(outDir, 'MAIDERES-API.postman_environment.json'), JSON.stringify(environment, null, 2))

console.log('Wrote collection with', collection.item.length, 'folders,', collection.item.reduce((n, f) => n + f.item.length, 0), 'requests')
