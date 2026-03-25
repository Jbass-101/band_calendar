import { type SchemaTypeDefinition } from 'sanity'

import { musician } from './musician'
import { service } from './service'
import { rehearsal } from './rehearsal'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [musician, service, rehearsal],
}
