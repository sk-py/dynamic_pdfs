export type JSONNode = {
  type: string;
  attrs?: Record<string, any>;
  content?: JSONNode[];
  marks?: any[];
  text?: string;
};

export type PageSettings = {
  size?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  /** Page margins in millimetres. Leave room for header/footer. */
  marginsMm?: { top: number; right: number; bottom: number; left: number };
};

/** What you store in your database for one template. */
export type TemplateDef = {
  body: JSONNode;
  header?: JSONNode;
  footer?: JSONNode;
  page?: PageSettings;
};
