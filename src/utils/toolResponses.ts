type TextContent = {
  type: "text";
  text: string;
};

export type ToolResponse = {
  content: TextContent[];
  isError?: boolean;
};

export const textResponse = (text: string): ToolResponse => ({
  content: [{ type: "text", text }],
});

export const errorResponse = (text: string): ToolResponse => ({
  content: [{ type: "text", text }],
  isError: true,
});

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
