import type { StructureResolver } from 'sanity/structure'
import { CalendarIcon } from '@sanity/icons'

const pad2 = (n: number) => String(n).padStart(2, '0')

function formatYM(d: Date) {
  const year = d.getFullYear()
  const monthIndex = d.getMonth()
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(d)
  return { year, monthIndex, monthName }
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function monthRange(fromInclusive: Date, toExclusive: Date) {
  const months: Date[] = []
  const cursor = new Date(fromInclusive.getFullYear(), fromInclusive.getMonth(), 1)
  const end = new Date(toExclusive.getFullYear(), toExclusive.getMonth(), 1)

  while (cursor < end) {
    months.push(new Date(cursor.getFullYear(), cursor.getMonth(), 1))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return months
}

export const structure: StructureResolver = (S) => {
  const now = new Date()
  // Desktop app only shows a couple months ahead, but for Studio it’s useful
  // to keep a reasonable window without querying for distinct months.
  const months = monthRange(
    new Date(now.getFullYear(), now.getMonth() - 12, 1),
    new Date(now.getFullYear(), now.getMonth() + 12, 1)
  )

  const monthsByYear = months.reduce<Record<string, Date[]>>((acc, d) => {
    const { year } = formatYM(d)
    acc[String(year)] = acc[String(year)] ?? []
    acc[String(year)].push(d)
    return acc
  }, {})

  const serviceListForMonth = (from: Date, to: Date) => {
    const fromStr = toYmd(from)
    const toStr = toYmd(to)

    return S.documentTypeList('service')
      .title('Services')
      .filter('date >= $from && date < $to')
      .params({ from: fromStr, to: toStr })
      .defaultOrdering([{ field: 'date', direction: 'desc' }])
  }

  const servicesByYear = Object.entries(monthsByYear).map(([year, yearMonths]) => {
    return S.listItem()
      .title(String(year))
      .icon(CalendarIcon)
      .child(
        S.list()
          .title(`Services - ${year}`)
          .items(
            yearMonths.map((m) => {
              const next = new Date(m.getFullYear(), m.getMonth() + 1, 1)
              const { monthName } = formatYM(m)
              return S.listItem()
                .title(`${monthName} ${year}`)
                .child(serviceListForMonth(m, next))
            })
          )
      )
  })

  return S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Services (by month)')
        .icon(CalendarIcon)
        .child(S.list().title('Services by Year / Month').items(servicesByYear)),

      S.divider(),

      ...S.documentTypeListItems().filter((listItem) => {
        const id = listItem.getId()
        return id !== 'service'
      }),
    ])
}
