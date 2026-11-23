import type { Connector } from './importer'

export type PartnerId = 'heureka' | 'bazos' | 'meta'
type Partner = { name: string; approval: string; connector: Connector | null }

// Register a connector only after obtaining a documented transport and usage terms.
export const partners: Record<PartnerId, Partner> = {
  heureka: {
    name: 'Heureka',
    approval:
      'API plan, endpoint scopes, retention and downstream public display agreement.',
    connector: null,
  },
  bazos: {
    name: 'Bazoš',
    approval:
      'Written partner access, listing feed, public display and retention terms.',
    connector: null,
  },
  meta: {
    name: 'Facebook Marketplace',
    approval: 'Approved listing access for Slovakia, scopes and display terms.',
    connector: null,
  },
}
