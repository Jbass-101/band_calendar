import { type SchemaTypeDefinition } from 'sanity'

import { musician } from './musician'
import { service } from './service'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [musician, service],
}
