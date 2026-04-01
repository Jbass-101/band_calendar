import { type SchemaTypeDefinition } from 'sanity'

import { musician } from './musician'
import { service } from './service'
import { rehearsal } from './rehearsal'
import { contribution } from './contribution'
import { contributionAccess } from './contributionAccess'
import { contributionExpense } from './contributionExpense'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [musician, service, rehearsal, contribution, contributionAccess, contributionExpense],
}
