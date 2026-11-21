// Where the client gets its data, chosen when the app is built: the demo (seed
// data, local storage, simulated sign-in) or the real API. There is no default,
// so a real deployment can never fall into the demo by forgetting a setting.
export const DATA_SOURCES = ['demo', 'api'] as const

export type DataSource = (typeof DATA_SOURCES)[number]

export function resolveDataSource(value: string | undefined): DataSource {
  const found = DATA_SOURCES.find((source) => source === value)
  if (!found) {
    throw new Error(
      `VITE_DATA_SOURCE must be "demo" or "api" (got ${value ? `"${value}"` : 'nothing'}). ` +
        'Use npm run dev, dev:api, build:demo or build:api, or set the variable.',
    )
  }
  return found
}
