import type { Tag, Contact } from '../types';

interface NestedTag {
  tag: Tag;
}

type RawTag = Tag | NestedTag;

export function normalizeTags(rawTags: RawTag[] | undefined | null): Tag[] {
  if (!rawTags || !Array.isArray(rawTags)) {
    return [];
  }

  return rawTags
    .map((item) => {
      if ('tag' in item && item.tag && typeof item.tag === 'object') {
        return item.tag as Tag;
      }
      return item as Tag;
    })
    .filter((tag): tag is Tag => tag !== null && tag !== undefined && typeof tag.id === 'string');
}

export function normalizeContactTags<T extends { tags?: unknown }>(
  contact: T | null | undefined
): T | null | undefined {
  if (!contact) return contact;

  return {
    ...contact,
    tags: normalizeTags(contact.tags as RawTag[]),
  };
}

export function normalizeContactsArray<T extends { tags?: unknown }>(
  contacts: T[] | null | undefined
): T[] {
  if (!contacts) return [];

  return contacts.map((contact) => normalizeContactTags(contact) as T);
}
