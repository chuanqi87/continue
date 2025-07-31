import { ContextItem, Tool, ToolCall, ToolExtras } from "..";
import { MCPManagerSingleton } from "../context/mcp/MCPManagerSingleton";
import { canParseUrl } from "../util/url";
import { BuiltInToolNames } from "./builtIn";

import { codebaseToolImpl } from "./implementations/codebaseTool";
import { createNewFileImpl } from "./implementations/createNewFile";
import { createRuleBlockImpl } from "./implementations/createRuleBlock";
import { fetchUrlContentImpl } from "./implementations/fetchUrlContent";
import { fileGlobSearchImpl } from "./implementations/globSearch";
import { grepSearchImpl } from "./implementations/grepSearch";
import { lsToolImpl } from "./implementations/lsTool";
import { readCurrentlyOpenFileImpl } from "./implementations/readCurrentlyOpenFile";
import { readFileImpl } from "./implementations/readFile";
import { requestRuleImpl } from "./implementations/requestRule";
import { runTerminalCommandImpl } from "./implementations/runTerminalCommand";
import { searchWebImpl } from "./implementations/searchWeb";
import { viewDiffImpl } from "./implementations/viewDiff";
import { viewRepoMapImpl } from "./implementations/viewRepoMap";
import { viewSubdirectoryImpl } from "./implementations/viewSubdirectory";
import { safeParseToolCallArgs } from "./parseArgs";

async function callHttpTool(
  url: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  console.log("[hbuilderx] callHttpTool: Starting HTTP tool call", {
    url,
    args,
  });
  try {
    const response = await extras.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        arguments: args,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[hbuilderx] callHttpTool: HTTP request failed", {
        url,
        status: response.status,
        statusText: response.statusText,
        data,
      });
      throw new Error(
        `Failed to call tool at ${url}:\n${JSON.stringify(data)}`,
      );
    }

    console.log(
      "[hbuilderx] callHttpTool: HTTP tool call completed successfully",
      { url },
    );
    return data.output;
  } catch (error: unknown) {
    console.error("[hbuilderx] callHttpTool: Error occurred", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function encodeMCPToolUri(mcpId: string, toolName: string): string {
  return `mcp://${encodeURIComponent(mcpId)}/${encodeURIComponent(toolName)}`;
}

export function decodeMCPToolUri(uri: string): [string, string] | null {
  const url = new URL(uri);
  if (url.protocol !== "mcp:") {
    return null;
  }
  return [
    decodeURIComponent(url.hostname),
    decodeURIComponent(url.pathname).slice(1), // to remove leading '/'
  ];
}

async function callToolFromUri(
  uri: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  console.log("[hbuilderx] callToolFromUri: Starting URI-based tool call", {
    uri,
    args,
  });

  const parseable = canParseUrl(uri);
  if (!parseable) {
    console.error("[hbuilderx] callToolFromUri: Invalid URI", { uri });
    throw new Error(`Invalid URI: ${uri}`);
  }
  const parsedUri = new URL(uri);

  switch (parsedUri?.protocol) {
    case "http:":
    case "https:":
      return callHttpTool(uri, args, extras);
    case "mcp:":
      console.log("[hbuilderx] callToolFromUri: Processing MCP tool call", {
        uri,
      });
      const decoded = decodeMCPToolUri(uri);
      if (!decoded) {
        console.error("[hbuilderx] callToolFromUri: Invalid MCP tool URI", {
          uri,
        });
        throw new Error(`Invalid MCP tool URI: ${uri}`);
      }
      const [mcpId, toolName] = decoded;
      const client = MCPManagerSingleton.getInstance().getConnection(mcpId);

      if (!client) {
        console.error("[hbuilderx] callToolFromUri: MCP connection not found", {
          mcpId,
        });
        throw new Error("MCP connection not found");
      }

      try {
        const response = await client.client.callTool({
          name: toolName,
          arguments: args,
        });

        if (response.isError === true) {
          console.error(
            "[hbuilderx] callToolFromUri: MCP tool call returned error",
            {
              mcpId,
              toolName,
              response,
            },
          );
          throw new Error(JSON.stringify(response.content));
        }

        console.log(
          "[hbuilderx] callToolFromUri: MCP tool call completed successfully",
          { mcpId, toolName },
        );
        const contextItems: ContextItem[] = [];
        (response.content as any).forEach((item: any) => {
          if (item.type === "text") {
            contextItems.push({
              name: extras.tool.displayTitle,
              description: "Tool output",
              content: item.text,
              icon: extras.tool.faviconUrl,
            });
          } else if (item.type === "resource") {
            // TODO resource change subscribers https://modelcontextprotocol.io/docs/concepts/resources
            if (item.resource?.blob) {
              contextItems.push({
                name: extras.tool.displayTitle,
                description: "MCP Item Error",
                content:
                  "Error: tool call received unsupported blob resource item",
                icon: extras.tool.faviconUrl,
              });
            }
            // TODO account for mimetype? // const mimeType = item.resource.mimeType
            // const uri = item.resource.uri;
            contextItems.push({
              name: extras.tool.displayTitle,
              description: "Tool output",
              content: item.resource.text,
              icon: extras.tool.faviconUrl,
            });
          } else {
            contextItems.push({
              name: extras.tool.displayTitle,
              description: "MCP Item Error",
              content: `Error: tool call received unsupported item of type "${item.type}"`,
              icon: extras.tool.faviconUrl,
            });
          }
        });
        return contextItems;
      } catch (error: unknown) {
        console.error("[hbuilderx] callToolFromUri: MCP tool call failed", {
          mcpId,
          toolName,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    default:
      console.error("[hbuilderx] callToolFromUri: Unsupported protocol", {
        protocol: parsedUri?.protocol,
      });
      throw new Error(`Unsupported protocol: ${parsedUri?.protocol}`);
  }
}

export async function callBuiltInTool(
  functionName: string,
  args: any,
  extras: ToolExtras,
): Promise<ContextItem[]> {
  console.log("[hbuilderx] callBuiltInTool: Starting built-in tool call", {
    functionName,
    args,
  });

  try {
    let result: ContextItem[];
    switch (functionName) {
      case BuiltInToolNames.ReadFile:
        result = await readFileImpl(args, extras);
        break;
      case BuiltInToolNames.CreateNewFile:
        result = await createNewFileImpl(args, extras);
        break;
      case BuiltInToolNames.GrepSearch:
        result = await grepSearchImpl(args, extras);
        break;
      case BuiltInToolNames.FileGlobSearch:
        result = await fileGlobSearchImpl(args, extras);
        break;
      case BuiltInToolNames.RunTerminalCommand:
        result = await runTerminalCommandImpl(args, extras);
        break;
      case BuiltInToolNames.SearchWeb:
        result = await searchWebImpl(args, extras);
        break;
      case BuiltInToolNames.FetchUrlContent:
        result = await fetchUrlContentImpl(args, extras);
        break;
      case BuiltInToolNames.ViewDiff:
        result = await viewDiffImpl(args, extras);
        break;
      case BuiltInToolNames.LSTool:
        result = await lsToolImpl(args, extras);
        break;
      case BuiltInToolNames.ReadCurrentlyOpenFile:
        result = await readCurrentlyOpenFileImpl(args, extras);
        break;
      case BuiltInToolNames.CreateRuleBlock:
        result = await createRuleBlockImpl(args, extras);
        break;
      case BuiltInToolNames.RequestRule:
        result = await requestRuleImpl(args, extras);
        break;
      case BuiltInToolNames.CodebaseTool:
        result = await codebaseToolImpl(args, extras);
        break;
      case BuiltInToolNames.ViewRepoMap:
        result = await viewRepoMapImpl(args, extras);
        break;
      case BuiltInToolNames.ViewSubdirectory:
        result = await viewSubdirectoryImpl(args, extras);
        break;
      default:
        console.error("[hbuilderx] callBuiltInTool: Tool not found", {
          functionName,
        });
        throw new Error(`Tool "${functionName}" not found`);
    }

    console.log(
      "[hbuilderx] callBuiltInTool: Built-in tool call completed successfully",
      {
        functionName,
        resultCount: result.length,
      },
    );
    return result;
  } catch (error: unknown) {
    console.error("[hbuilderx] callBuiltInTool: Built-in tool call failed", {
      functionName,
      args,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Handles calls for core/non-client tools
// Returns an error context item if the tool call fails
// Note: Edit tool is handled on client
export async function callTool(
  tool: Tool,
  toolCall: ToolCall,
  extras: ToolExtras,
): Promise<{
  contextItems: ContextItem[];
  errorMessage: string | undefined;
}> {
  console.log("[hbuilderx] callTool: Starting tool call", {
    toolName: tool.function.name,
    toolCallId: toolCall.id,
    hasUri: !!tool.uri,
  });

  try {
    const args = safeParseToolCallArgs(toolCall);
    console.log("[hbuilderx] callTool: Parsed tool call arguments", {
      toolName: tool.function.name,
      args,
    });

    const contextItems = tool.uri
      ? await callToolFromUri(tool.uri, args, extras)
      : await callBuiltInTool(tool.function.name, args, extras);

    console.log("[hbuilderx] callTool: Tool execution completed", {
      toolName: tool.function.name,
      toolCallId: toolCall.id,
      contextItemsCount: contextItems.length,
      contextItemsDetails: contextItems.map((item) => ({
        name: item.name,
        description: item.description,
        contentLength: item.content?.length || 0,
        hasIcon: !!item.icon,
      })),
    });

    if (tool.faviconUrl) {
      contextItems.forEach((item) => {
        item.icon = tool.faviconUrl;
      });
      console.log("[hbuilderx] callTool: Applied favicon to context items", {
        toolName: tool.function.name,
        faviconUrl: tool.faviconUrl,
      });
    }

    console.log("[hbuilderx] callTool: Tool call completed successfully", {
      toolName: tool.function.name,
      toolCallId: toolCall.id,
      contextItemsCount: contextItems.length,
      returningResult: {
        contextItemsCount: contextItems.length,
        errorMessage: undefined,
      },
    });

    return {
      contextItems,
      errorMessage: undefined,
    };
  } catch (e) {
    let errorMessage = `${e}`;
    if (e instanceof Error) {
      errorMessage = e.message;
    }

    console.error("[hbuilderx] callTool: Tool call failed", {
      toolName: tool.function.name,
      toolCallId: toolCall.id,
      errorMessage,
      errorStack: e instanceof Error ? e.stack : undefined,
      returningResult: {
        contextItemsCount: 0,
        errorMessage,
      },
    });

    return {
      contextItems: [],
      errorMessage,
    };
  }
}
