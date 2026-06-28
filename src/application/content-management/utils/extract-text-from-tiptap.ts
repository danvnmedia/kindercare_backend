import { PostContent } from "@/domain/content-management/entities/post.entity";

/**
 * Tiptap/ProseMirror node type definitions for text extraction.
 */
interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string }>;
}

/**
 * Extracts plain text from Tiptap/ProseMirror JSON content.
 * Recursively traverses the JSON structure and extracts text from 'text' nodes.
 *
 * @param content - The Tiptap JSON content (PostContent type)
 * @returns Plain text extracted from the content, or empty string if content is null/invalid
 *
 * @example
 * const tiptapJson = {
 *   type: 'doc',
 *   content: [
 *     {
 *       type: 'paragraph',
 *       content: [{ type: 'text', text: 'Hello World' }]
 *     }
 *   ]
 * };
 * extractTextFromTiptap(tiptapJson); // Returns: 'Hello World'
 */
export function extractTextFromTiptap(content: PostContent): string {
  if (!content) {
    return "";
  }

  const textParts: string[] = [];
  extractTextRecursively(content as unknown as TiptapNode, textParts);

  return textParts.join(" ").trim();
}

/**
 * Recursively extracts text from a Tiptap node and its children.
 *
 * @param node - The current node to process
 * @param textParts - Array to accumulate extracted text parts
 */
function extractTextRecursively(node: TiptapNode, textParts: string[]): void {
  // Extract text from text nodes
  if (node.type === "text" && node.text) {
    textParts.push(node.text);
    return;
  }

  // Handle nodes with content (paragraphs, headings, lists, etc.)
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      extractTextRecursively(child, textParts);

      // Add line break after block-level elements for better text separation
      if (isBlockElement(child.type)) {
        textParts.push("\n");
      }
    }
  }
}

/**
 * Checks if a node type is a block-level element.
 * Block elements get a line break after them for better text separation.
 *
 * @param type - The node type to check
 * @returns True if the node is a block-level element
 */
function isBlockElement(type: string): boolean {
  const blockElements = [
    "paragraph",
    "heading",
    "blockquote",
    "codeBlock",
    "listItem",
    "bulletList",
    "orderedList",
    "taskList",
    "taskItem",
    "horizontalRule",
    "table",
    "tableRow",
    "tableCell",
    "tableHeader",
  ];

  return blockElements.includes(type);
}
