/**
 * Typed, validated Firestore repository factory.
 *
 * Every feature's data access is built from this (e.g. a forms repository, an
 * audits repository). Reads are validated with Zod, so malformed or legacy
 * documents are skipped and logged instead of crashing a screen.
 *
 * Swapping Firestore for another backend later means re-implementing this
 * factory only; feature code depends on the `Repository<T>` interface.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type QueryConstraint,
} from 'firebase/firestore';
import type { z } from 'zod';
import { firestore } from '@/services/firebase/client';
import { logger } from '@/services/monitoring/logger';

export type WithId<T> = T & { id: string };

export interface ListOptions {
  orderByField?: string;
  direction?: 'asc' | 'desc';
  limit?: number;
}

export interface Repository<T> {
  get(id: string): Promise<WithId<T> | null>;
  list(options?: ListOptions): Promise<WithId<T>[]>;
  create(data: T): Promise<string>;
  update(id: string, data: Partial<T>): Promise<void>;
}

export function createRepository<S extends z.ZodType<Record<string, unknown>>>(
  collectionPath: string,
  schema: S,
): Repository<z.infer<S>> {
  type T = z.infer<S>;
  const ref = () => collection(firestore(), collectionPath);

  const parse = (id: string, data: unknown): WithId<T> | null => {
    const result = schema.safeParse(data);
    if (!result.success) {
      logger.warn('Skipped invalid document', { collectionPath, id, issues: result.error.issues.length });
      return null;
    }
    return { ...(result.data as T), id };
  };

  return {
    async get(id) {
      const snapshot = await getDoc(doc(ref(), id));
      return snapshot.exists() ? parse(snapshot.id, snapshot.data()) : null;
    },
    async list({ orderByField, direction = 'desc', limit = 100 } = {}) {
      const constraints: QueryConstraint[] = [];
      if (orderByField) constraints.push(orderBy(orderByField, direction));
      constraints.push(limitTo(limit)); // always bounded: protects memory and read costs
      const snapshot = await getDocs(query(ref(), ...constraints));
      return snapshot.docs.map((d) => parse(d.id, d.data())).filter((d): d is WithId<T> => d !== null);
    },
    async create(data) {
      const validated = schema.parse(data);
      const created = await addDoc(ref(), { ...validated, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return created.id;
    },
    async update(id, data) {
      await updateDoc(doc(ref(), id), { ...data, updatedAt: serverTimestamp() });
    },
  };
}
