import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WORKSPACE_ROOT } from "./config/constants.js";
import { GitClient } from "./utils/gitClient.js";
import { NpmClient } from "./utils/npmClient.js";
import { WorkspaceManager } from "./utils/workspaceManager.js";
import { registerFileTools } from "./tools/fileTools.js";
import { registerGitTools } from "./tools/gitTools.js";
import { registerNpmTools } from "./tools/npmTools.js";
import { registerStartWorkTools } from "./tools/startWorkTools.js";

const server = new McpServer({
  name: "SimpleFileManager",
  version: "1.0.0",
});

const workspaceManager = new WorkspaceManager({ workspaceRoot: WORKSPACE_ROOT });
const gitClient = new GitClient(workspaceManager);
const npmClient = new NpmClient(workspaceManager);

registerFileTools(server, workspaceManager, gitClient);
registerGitTools(server, gitClient);
registerNpmTools(server, npmClient);
registerStartWorkTools(server, gitClient, npmClient);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Simple File Manager MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
