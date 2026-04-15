import { type SchemaTypeDefinition } from 'sanity'

import { musician } from './musician'
import { service } from './service'
import { rehearsal } from './rehearsal'
import { contribution } from './contribution'
import { contributionAccess } from './contributionAccess'
import { contributionExpense } from './contributionExpense'
import { contributionLog } from './contributionLog'
import { song } from './song'
import { songTheme } from './songTheme'
import { songTag } from './songTag'
import { setlist } from './setlist'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [musician, service, rehearsal, contribution, contributionAccess, contributionExpense, contributionLog, song, songTheme, songTag, setlist],
}
