/** A named collection of user-added ESV passages. */
export type CustomList = {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

/** User-added ESV passage, always belonging to one custom list. */
export type CustomVerse = {
  id: string;
  /** Owning custom list. */
  listId: string;
  order: number;
  /** Reference as entered or returned by ESV (display). */
  reference: string;
  text: string;
  translation: 'ESV';
  createdAt: string;
  updatedAt: string;
};
