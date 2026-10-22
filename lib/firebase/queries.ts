import { collection, query, where, type Firestore, type Query } from 'firebase/firestore'

/**
 * Organizations the user is a member of.
 *
 * firestore.rules only allows `list` on /organizations when the query is
 * constrained to the caller's own `members.<uid>.role` (rules are not filters),
 * so every org listing in the client must go through this builder. The rules
 * test (tests/rules/firestore.rules.test.ts) runs this exact query.
 */
export function userOrganizationsQuery(db: Firestore, uid: string): Query {
  return query(collection(db, 'organizations'), where(`members.${uid}.role`, '!=', null))
}
